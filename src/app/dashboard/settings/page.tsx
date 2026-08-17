import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const nameFromMetadata = user.user_metadata?.full_name || user.user_metadata?.name || "";
  const initialName = profile?.name || nameFromMetadata || "";

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

      <SettingsForm userEmail={user.email || ""} initialName={initialName} />
    </div>
  );
}
