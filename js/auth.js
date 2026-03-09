/* ===== ЛЮМС — Auth Module ===== */

var currentUser = null;

// --- Check auth state on page load ---
async function initAuth() {
  initSupabase();
  if (!db) return null;

  try {
    var { data: { session } } = await db.auth.getSession();
    if (session && session.user) {
      currentUser = session.user;
      await loadUserProfile();
      updateAuthUI();
      return currentUser;
    }
  } catch(e) {
    console.error('Auth init error:', e);
  }
  updateAuthUI();
  return null;
}

// --- Load user profile from profiles table ---
async function loadUserProfile() {
  if (!db || !currentUser) return;
  try {
    var { data, error } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
    if (!error && data) {
      currentUser.profile = data;
    }
  } catch(e) {
    console.error('Profile load error:', e);
  }
}

// --- Send magic link ---
async function sendMagicLink(email) {
  initSupabase();
  if (!db) return { success: false, error: 'Supabase не подключен' };

  // Determine redirect URL based on current location
  var baseUrl = window.location.origin;
  var redirectUrl = baseUrl + '/account/';

  var { error } = await db.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: redirectUrl
    }
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// --- Sign out ---
async function signOut() {
  if (!db) return;
  await db.auth.signOut();
  currentUser = null;
  updateAuthUI();
  window.location.href = '/';
}

// --- Update header UI based on auth state ---
function updateAuthUI() {
  var accountLinks = document.querySelectorAll('.account-link');
  accountLinks.forEach(function(link) {
    if (currentUser) {
      link.href = link.getAttribute('data-account-url') || '/account/';
      link.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      link.title = currentUser.email;
    } else {
      link.href = link.getAttribute('data-login-url') || '/login/';
      link.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      link.title = 'Войти';
    }
  });
}

// --- Save/update profile ---
async function saveProfile(data) {
  if (!db || !currentUser) return { success: false };

  var profileData = {
    id: currentUser.id,
    name: data.name || '',
    phone: data.phone || '',
    updated_at: new Date().toISOString()
  };

  var { error } = await db.from('profiles').upsert(profileData);
  if (error) {
    console.error('Profile save error:', error);
    return { success: false, error: error.message };
  }
  currentUser.profile = profileData;
  return { success: true };
}

// --- Get user orders ---
async function getUserOrders() {
  if (!db || !currentUser) return [];

  try {
    var { data, error } = await db
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch(e) {
    console.error('Orders fetch error:', e);
    return [];
  }
}

// --- Init auth on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function() {
  initAuth();
});
