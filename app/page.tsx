import { chatGPTSignOutPath, requireChatGPTUser } from "@/app/chatgpt-auth";
import { ExpansionDashboard } from "@/app/expansion-dashboard";
import { getDashboardData } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  const data = await getDashboardData(user.email);

  return (
    <ExpansionDashboard
      initialData={data}
      userName={user.displayName}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
