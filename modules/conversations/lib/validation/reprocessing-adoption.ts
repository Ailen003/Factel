import {
  clientFieldKeys, requestFieldKeys, proposalDraftSchema, isPersistentFinding, maxProposalFindings,
  type ProposalRevisionView, type ResolveReprocessingCandidateInput, type ProposalField, type ProposalFinding,
} from "../types/proposal.types";
import { ProposalValidationError, validateProposalDraft, fieldIdentity } from "./proposal-validation";

/** Selections refer to persisted data only. Item correspondence is always a human choice. */
export function adoptReprocessingSelection(current: ProposalRevisionView, candidate: ProposalRevisionView,
  selection: ResolveReprocessingCandidateInput, newItemId: () => string) {
  const invalid = () => { throw new ProposalValidationError("VALIDATION_ERROR"); };
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(selection.clientFields) || !unique(selection.removeRequestIds)
    || !unique(selection.requests.map((item) => item.candidateItemId))
    || !unique(selection.requests.flatMap((item) => item.targetItemId ? [item.targetItemId] : []))) invalid();
  if (selection.keepPrevious) {
    if (selection.clientFields.length || selection.requests.length || selection.removeRequestIds.length) invalid();
    return { draft: current.draft, fields: current.fields, findings: current.findings };
  }
  if (!selection.clientFields.length && !selection.requests.length && !selection.removeRequestIds.length) invalid();
  const draft = structuredClone(current.draft);
  const currentIds = new Set(draft.requests.map((item) => item.stableItemId));
  if (selection.removeRequestIds.some((id) => !currentIds.has(id))) invalid();
  draft.requests = draft.requests.filter((item) => !selection.removeRequestIds.includes(item.stableItemId));
  const selected = new Map<string, ProposalField>();
  const candidateFields = new Map(candidate.fields.map((field) => [fieldIdentity(field.target, field.itemId, field.fieldKey), field]));
  const transferred = new Map<string, string>();
  const itemMapping = new Map<string, string>();
  function transfer(target: "client" | "request", sourceId: string | null, targetId: string | null,
    fieldKey: ProposalField["fieldKey"]) {
    const sourceKey = fieldIdentity(target, sourceId, fieldKey);
    const targetKey = fieldIdentity(target, targetId, fieldKey);
    const source = candidateFields.get(sourceKey);
    if (!source) invalid();
    selected.set(targetKey, { ...source!, itemId: targetId });
    transferred.set(sourceKey, targetKey);
  }
  for (const key of clientFieldKeys) if (selection.clientFields.includes(key)) {
    draft.client[key] = candidate.draft.client[key];
    transfer("client", null, null, key);
  }
  for (const choice of selection.requests) {
    if (!unique(choice.fields)) invalid();
    const source = candidate.draft.requests.find((item) => item.stableItemId === choice.candidateItemId);
    if (!source) invalid();
    let target = choice.targetItemId ? draft.requests.find((item) => item.stableItemId === choice.targetItemId) : undefined;
    if (choice.targetItemId && !target) invalid();
    if (!choice.targetItemId) {
      if (choice.fields.length !== requestFieldKeys.length) invalid();
      target = { ...source!, stableItemId: newItemId() };
      draft.requests.push(target);
    }
    itemMapping.set(choice.candidateItemId, target!.stableItemId);
    for (const key of choice.fields) {
      // The source value has the same field-specific type as the destination.
      Object.assign(target!, { [key]: source![key] });
      transfer("request", source!.stableItemId, target!.stableItemId, key);
    }
  }
  if (!proposalDraftSchema.safeParse(draft).success) invalid();
  const retainedIds = new Set(draft.requests.map((item) => item.stableItemId));
  const fields = current.fields.filter((field) => field.target === "client" || retainedIds.has(field.itemId!))
    .filter((field) => !selected.has(fieldIdentity(field.target, field.itemId, field.fieldKey)));
  fields.push(...selected.values());
  const changed = JSON.stringify(draft) !== JSON.stringify(current.draft);
  const previousFindings = current.findings.filter((finding) => isPersistentFinding(finding.code)
    && (finding.target !== "request" || retainedIds.has(finding.itemId!))
    && !(finding.fieldKey && finding.target !== "conversation" && selected.has(fieldIdentity(finding.target, finding.itemId, finding.fieldKey))))
    .map((finding, index): ProposalFinding => ({ ...finding, id: `retained-${index}`,
      resolution: changed && (finding.target === "conversation"
        || finding.target === "client" && !finding.fieldKey && selection.clientFields.length > 0
        || finding.target === "request" && !finding.fieldKey && selection.requests.some((item) => item.targetItemId === finding.itemId)) ? null : finding.resolution }));
  const incomingFindings = candidate.findings.filter((finding) => isPersistentFinding(finding.code)
    && (finding.target === "conversation"
      || finding.fieldKey && transferred.has(fieldIdentity(finding.target as "client" | "request", finding.itemId, finding.fieldKey))
      || !finding.fieldKey && (finding.target === "client" ? selection.clientFields.length > 0 : itemMapping.has(finding.itemId!))))
    .map((finding, index): ProposalFinding => ({ ...finding, id: `adopted-${index}`,
      itemId: finding.target === "request" ? itemMapping.get(finding.itemId!)! : null, resolution: null }));
  const findings = [...validateProposalDraft(draft), ...previousFindings, ...incomingFindings];
  if (findings.length > maxProposalFindings) invalid();
  return { draft, fields, findings };
}
