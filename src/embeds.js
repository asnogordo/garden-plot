const { EmbedBuilder } = require('discord.js');

function createCommunityStatsEmbed(statsObj, activeUsers) {
  return new EmbedBuilder()
    .setTitle('Garden Community Stats')
    .setColor('#0099ff')
    .addFields(
      { name: 'Total Users', value: statsObj.total_users.toString(), inline: true },
      { name: 'Total Points', value: statsObj.total_points.toString(), inline: true },
      { name: 'Monthly Active Users', value: activeUsers.count.toString(), inline: true },
      { name: 'Points This Month', value: statsObj.monthly_points.toString(), inline: true }
    );
}

function createLeaderboardEmbed(topUsers) {
  const embed = new EmbedBuilder()
    .setTitle('Community Engagement Leaderboard')
    .setColor('#0099ff');

  topUsers.forEach((user, index) => {
    let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    embed.addFields({ name: `${medal} #${index + 1}`, value: `<@${user.discord_id}> - ${user.points} points` });
  });

  return embed;
}

module.exports = {
  createCommunityStatsEmbed,
  createLeaderboardEmbed
};