exports.run = async (bot, msg, args) => {
  if (!args.length) {
    return msg.error('You must provide some text to convert!')
  }

  const emojis = bot.utils.buildEmojisArray(args.join(' '), {
    guild: msg.guild,
    preserve: true,
    external: msg.guild ? msg.channel.permissionsFor(msg.guild.me).has('USE_EXTERNAL_EMOJIS') : true
  })

  if (!emojis.length) {
    return msg.error('Unable to parse text into emojis!')
  }

  return msg.edit(emojis.join(' '))
}

exports.info = {
  name: 'fanceh',
  usage: 'fanceh <text|emoji|both>',
  description: 'Renders text in big emoji letters',
  aliases: ['fancy', 'letters']
}
