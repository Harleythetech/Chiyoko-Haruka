const YouTubeMixHandler = require('./YouTubeMixHandler');

/**
 * YouTube Mix Integration for MusicPlayer
 * Provides clean integration functions for the advanced YouTube Mix handler
 */

// Initialize the mix handler instance
const mixHandler = new YouTubeMixHandler();

// Handle YouTube Mix for the music player
async function handleYouTubeMix(interaction, url, player) {
    try {
        await interaction.editReply({ content: '🎲 Loading YouTube Mix...' });
        
        // Process the mix using the handler's getMixSongs method
        const result = await mixHandler.getMixSongs(url, 30);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        if (!result.songs || result.songs.length === 0) {
            throw new Error('No songs found in the YouTube Mix');
        }
        
        let addedCount = 0;
        let skippedCount = 0;
        let firstSong = null;
        const wasEmpty = player.queue.length === 0 && player.audioPlayer.state.status !== 'playing';
        
        await interaction.editReply({ content: '🔄 Processing mix songs...' });
        
        // Add songs to queue with HD thumbnails
        for (const video of result.songs) {
            if (!video.id || video.title === '[Private video]' || video.title === '[Deleted video]') {
                skippedCount++;
                continue;
            }
            
            const song = {
                title: video.title,
                url: video.url,
                duration: video.duration || 0,
                thumbnail: this.getHDThumbnail(video.url, video.thumbnail),
                channel: video.channel || 'Unknown',
                requestedBy: interaction.user.username,
                extractMethod: 'youtube-mix'
            };
            
            // Store the first song for the embed thumbnail
            if (!firstSong) {
                firstSong = song;
            }
            
            player.queue.push(song);
            addedCount++;
            
            // Update progress every 5 songs
            if (addedCount % 5 === 0) {
                await interaction.editReply({ 
                    content: `🔄 Added ${addedCount}/${result.songs.length} mix songs...` 
                });
            }
        }
        
        if (wasEmpty && addedCount > 0) {
            this.playNext(interaction.guildId);
            await this.sendEnhancedMixEmbed(interaction, {
                title: result.mixTitle || 'YouTube Mix',
                author: { name: 'YouTube' },
                id: result.mixId || 'mix',
                estimatedItemCount: addedCount
            }, addedCount, firstSong, skippedCount);
        } else {
            const message = `✅ Added **${addedCount}** songs from YouTube Mix to the queue` +
                           (skippedCount > 0 ? ` (${skippedCount} songs skipped)` : '');
            await interaction.editReply({ content: message });
        }
        
    } catch (error) {
        console.error('Error handling YouTube Mix:', error);
        
        let errorMessage = '❌ Failed to process YouTube Mix. ';
        
        if (error.message.includes('robot') || error.message.includes('captcha')) {
            errorMessage += 'YouTube is temporarily blocking requests. Please try again in a few minutes.';
        } else if (error.message.includes('429')) {
            errorMessage += 'Rate limit exceeded. Please wait a moment before trying again.';
        } else if (error.message.includes('Mix not found')) {
            errorMessage += 'This mix may be unavailable or the URL format is not recognized.';
        } else {
            errorMessage += 'The mix may be unavailable or restricted.';
        }
        
        await interaction.editReply({ content: errorMessage });
    }
}

/**
 * Utility function to clear mix cache periodically
 */
function setupCacheCleaning() {
    // Clear cache every hour to prevent memory buildup
    setInterval(() => {
        mixHandler.clearCache();
    }, 60 * 60 * 1000); // 1 hour
}

// Export the functions and handler for use
module.exports = {
    mixHandler,
    handleYouTubeMix,
    setupCacheCleaning
};
