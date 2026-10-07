---
name: i18n-conventions
description: Load whenever visible text, validation copy, error messages, or en/es message files change.
---

# i18n Conventions

This project uses next-intl with `messages/en.json` and `messages/es.json`.
Never hardcode visible text. Update both locale files together and keep root
namespaces alphabetized.

Use camelCase namespaces:

- `<module>` for title, description, create action, and service error codes;
- `<entity>Details` for detail/edit/delete modal text;
- `<entity>Form` for fields, validation, submit/cancel states;
- shared `filters` for generic filter copy.

Async Server Components use `getTranslations` from `next-intl/server`.
Client Components use `useTranslations`. Map a `ServiceResponse` code through
`t.has("errors.<code>")`, falling back to the server message. Use ICU
pluralization with `{count, plural, ...}`.

Checklist:

- [ ] Every visible string resolves through `t`.
- [ ] Both locales contain matching keys and meaningful translations.
- [ ] Validation factories receive localized messages.
- [ ] Stable service codes exist under module errors.
- [ ] Server/client translation APIs match the component boundary.

See message usage throughout `.agent/reference/widget/`.
