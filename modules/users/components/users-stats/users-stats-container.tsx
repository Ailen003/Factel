import { getUsersStatsAction } from "../../lib/actions/user.actions";
import UsersStatsPresentational from "./users-stats-presentational";

export default async function UsersStatsContainer() {
  const stats = await getUsersStatsAction();
  if (!stats.success) throw new Error(stats.error.code);
  return <UsersStatsPresentational stats={stats.data} />;
}
