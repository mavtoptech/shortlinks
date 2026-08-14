import { createClient } from "@/utils/supabase/server";
import { updateProfile } from "@/app/actions/settings";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium mb-4">Profile Information</h2>
        
        <form action={updateProfile} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              disabled
              value={user.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed currently.</p>
          </div>
          
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              defaultValue={profile?.name || ""}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            type="submit"
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            Save Changes
          </button>
        </form>
      </div>

      <div className="mt-8 glass-panel p-6 sm:p-8 border border-red-200 bg-red-50/50">
        <h2 className="text-xl font-bold mb-2 text-red-600">Danger Zone</h2>
        <p className="text-sm text-gray-600 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
        
        <button disabled className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-md opacity-50 cursor-not-allowed">
          Delete Account
        </button>
      </div>
    </div>
  );
}
