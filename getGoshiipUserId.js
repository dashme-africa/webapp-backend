async function fetchPlatformUserId() {
  try {
    const response = await axios.get(`${process.env.GOSHIIP_BASE_URL}/user/myprofile`, {
      headers: {
        Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
      },
    });

    const userId = response.data.data.id;
    console.log('Platform User ID:', userId);

    // Store this user_id in your database for later use
    // For example: save to a user record or store it in environment variables
    return userId;

  } catch (error) {
    console.error('Error fetching platform user ID:', error.response?.data || error.message);
    throw new Error('Failed to fetch platform user ID');
  }
}

// Call the function when the platform provider first integrates
fetchPlatformUserId();