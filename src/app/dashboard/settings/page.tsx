import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfile } from "@/app/actions/settings";

export default async function SettingsPage() {
  const userId = await requireAuth();
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 className="text-3xl font-bold mb-2">Account Settings</h1>
        <p className="text-secondary">Manage your profile and preferences.</p>
      </div>

      <div className="glass-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold mb-6 text-gray-200">Profile Information</h2>
        
        <form action={updateProfile} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Email Address</label>
            <input 
              type="email" 
              value={user.email} 
              disabled 
              className="input-field opacity-50 cursor-not-allowed" 
            />
            <p className="text-xs text-gray-500">Email cannot be changed.</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Full Name</label>
            <input 
              type="text" 
              name="name" 
              defaultValue={user.name || ""} 
              required 
              className="input-field" 
            />
          </div>

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel p-6 sm:p-8 border-red-500/20">
        <h2 className="text-xl font-bold mb-2 text-error">Danger Zone</h2>
        <p className="text-sm text-secondary mb-6">Once you delete your account, there is no going back. Please be certain.</p>
        
        <button disabled className="btn-secondary text-error border-error/50 opacity-50 cursor-not-allowed">
          Delete Account
        </button>
      </div>
    </div>
  );
}
