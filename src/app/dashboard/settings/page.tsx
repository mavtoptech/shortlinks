import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function SettingsPage() {
  const session = await getSessionUser();

  if (!session) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  const initialName = user?.name || session.name || "";

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", margin: "0 0 8px" }}>
          Settings
        </h1>
        <p style={{ fontSize: "15px", color: "#64748b", margin: 0 }}>
          Manage your profile details, password, and account preferences
        </p>
      </div>

      <SettingsForm userEmail={user?.email || session.email || ""} initialName={initialName} />
    </div>
  );
}
