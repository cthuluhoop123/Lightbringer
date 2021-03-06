exports.run = async (bot, msg, args) => {
  if (!bot.utils.hasEmbedPermission(msg.channel)) {
    return msg.error('No permission to use embed in this channel!')
  }

  const m = await bot.utils.getMsg(bot.utils.getChannel(args[1], msg.guild) || msg.channel, args[0])

  const nestedFields = []
  for (let i = 0; i < m.edits.length; i++) {
    nestedFields.push({
      icon: '•',
      title: `${i === m.edits.length - 1 ? 'Original' : (i === 0 ? 'Latest' : `Edit #${m.edits.length - i - 1}`)}`,
      fields: bot.utils.truncate(m.edits[i].content, 1024)
    })
  }

  return msg.edit(msg.content, {
    embed: bot.utils.formatEmbed('', '', nestedFields, {
      footer: `Edit history | ID: ${m.id}`
    })
  })
}

exports.info = {
  name: 'edits',
  usage: 'edits [id] [channel]',
  description: 'Gets all the recent edits of a particular message (dependent on the bot\'s cache)'
}
