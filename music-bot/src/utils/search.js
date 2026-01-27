const play = require('play-dl');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

/**
 * Search YouTube for a query
 * @param {string} query - Search query or URL
 * @returns {Promise<Object|null>} Track object or null
 */
async function searchYouTube(query) {
    try {
        // Check if it's a URL
        if (play.yt_validate(query) === 'video') {
            const info = await play.video_basic_info(query);
            return {
                title: info.video_details.title,
                url: info.video_details.url,
                duration: info.video_details.durationInSec,
                thumbnail: info.video_details.thumbnails[0]?.url || null
            };
        }

        // Check if it's a YouTube playlist
        if (play.yt_validate(query) === 'playlist') {
            const playlist = await play.playlist_info(query, { incomplete: true });
            const videos = await playlist.all_videos();
            return videos.map(v => ({
                title: v.title,
                url: v.url,
                duration: v.durationInSec,
                thumbnail: v.thumbnails[0]?.url || null
            }));
        }

        // Search for video
        const results = await play.search(query, { limit: 1 });
        if (!results.length) return null;

        const video = results[0];
        return {
            title: video.title,
            url: video.url,
            duration: video.durationInSec,
            thumbnail: video.thumbnails[0]?.url || null
        };

    } catch (error) {
        logger.error(`[Neurovia Music] YouTube search error: ${error.message}`);
        return null;
    }
}

/**
 * Convert Spotify URL to YouTube search
 * @param {string} url - Spotify URL
 * @returns {Promise<Object|Array|null>} Track(s) or null
 */
async function searchSpotify(url) {
    try {
        // Check Spotify type
        const spType = play.sp_validate(url);

        if (!spType || spType === 'search') {
            return null;
        }

        if (spType === 'track') {
            // Get Spotify track info
            const sp = await play.spotify(url);
            // Search on YouTube with track name + artist
            const searchQuery = `${sp.name} ${sp.artists?.[0]?.name || ''}`;
            return await searchYouTube(searchQuery);
        }

        if (spType === 'playlist' || spType === 'album') {
            const sp = await play.spotify(url);
            const tracks = [];

            // Limit to first 50 tracks for performance
            const allTracks = await sp.all_tracks();
            const limitedTracks = allTracks.slice(0, 50);

            for (const track of limitedTracks) {
                const searchQuery = `${track.name} ${track.artists?.[0]?.name || ''}`;
                const result = await searchYouTube(searchQuery);
                if (result && !Array.isArray(result)) {
                    tracks.push(result);
                }
            }

            return tracks.length ? tracks : null;
        }

        return null;

    } catch (error) {
        logger.error(`[Neurovia Music] Spotify search error: ${error.message}`);
        // Fall back to YouTube search with the URL as query
        return null;
    }
}

/**
 * Search for a track - handles YouTube, Spotify, and text queries
 * @param {string} query - Search query or URL
 * @returns {Promise<Object|Array|null>} Track(s) or null
 */
async function search(query) {
    // Check if Spotify URL
    if (query.includes('spotify.com')) {
        const result = await searchSpotify(query);
        if (result) return result;
        // Fall back to YouTube search if Spotify fails
    }

    // YouTube search (handles URLs and text queries)
    return await searchYouTube(query);
}

module.exports = {
    search,
    searchYouTube,
    searchSpotify
};
