/**
 * Admin authentication utilities
 * Provides helper functions for admin role validation
 */

/**
 * Check if user has admin role
 * Input: supabase client, user ID
 * Output: boolean indicating admin status
 */
export async function checkIsAdmin(
  supabase: any, 
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return data?.role === 'admin'
}

/**
 * Require admin access or throw 403
 * Input: supabase client, user ID
 * Output: void (throws if not admin)
 */
export async function requireAdmin(
  supabase: any, 
  userId: string
): Promise<void> {
  const isAdmin = await checkIsAdmin(supabase, userId)
  
  if (!isAdmin) {
    throw new Error('Admin access required')
  }
}

