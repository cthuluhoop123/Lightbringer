const bot = require('./bot').client
const Discord = require('discord.js')
const encodeUrl = require('encodeurl')
const snekfetch = require('snekfetch')
const emojiRegex = require('emoji-regex')()
const pixelAverage = require('pixel-average')

exports.guildColors = bot.storage('guild-colors')

exports.randomSelection = choices => {
  return choices[Math.floor(Math.random() * choices.length)]
}

exports.randomColor = () => {
  return [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  ]
}

exports.formatNumber = number => {
  if (isNaN(number)) {
    return NaN
  }

  let input = `${number}`
  if (number < 1e4) {
    return input
  }

  const out = []
  while (input.length > 3) {
    out.push(input.substr(input.length - 3, input.length))
    input = input.substr(0, input.length - 3)
  }
  return `${input},${out.reverse().join(',')}`
}

/*
exports.formatString = format => {
  const args = Array.prototype.slice.call(arguments, 1)
  return format.replace(/{(\d+)}/g, function (match, number) {
    return typeof args[number] !== 'undefined'
      ? args[number]
      : match
  })
}
*/

exports.truncate = (string, max, append = '') => {
  if (!string || !max || (1 + append.length) >= max) {
    return ''
  }

  if (string.length <= max && !append) {
    return string
  }

  string = string.slice(0, max - 1 - append.length)
  if (/\s/.test(string.charAt(string.length - 1))) {
    string = string.replace(/\s+?$/, '')
  }
  return string + '\u2026' + append
}

exports.hasEmbedPermission = channel => {
  return channel.guild ? channel.permissionsFor(channel.guild.me).has('EMBED_LINKS') : true
}

exports.embed = (title = '', description = '', fields = [], options = {}) => {
  const url = options.url || ''
  const color = options.color !== undefined ? options.color : this.randomColor()
  const footer = options.footer || ''
  const author = typeof options.author === 'object'
    ? options.author
    : { name: typeof options.author === 'string' ? options.author : '' }

  // This number will progressively be subtracted by
  // the length of every other fields to be used as
  // the maximum length that the description can take
  let maxLength = 2000

  fields = fields.map(obj => {
    // TODO: Truncate field's title

    if (options.inline) {
      obj.inline = true
    }

    // Maximum length of a field's value is 1024 characters
    if (obj.value.length > 1024) {
      obj.value = this.truncate(obj.value, 1024)
    }

    // Subtract with field's name and value
    maxLength -= obj.name.length
    maxLength -= obj.value.length

    return obj
  })

  // Maximum length of an embed's title is 256 characters
  if (title.length > 256) {
    title = this.truncate(title, 256)
  }

  // Subtract with title, footer and author's name
  maxLength -= title.length + footer.length + author.name.length

  // Cancel only if max length is less than 2 characters
  // We use 2 characters as to preserve the first character
  // for the original description, and the second character
  // for the triple dots (\u2026)
  if (maxLength < 2) {
    throw new Error('No leftover space for embed\u2026')
  }

  // Use maximum length for description
  if (description.length > maxLength) {
    description = this.truncate(description, maxLength)
  }

  /* // 0w0. What's this???
  if (url !== '') {
    description = this.truncate(description, description.length, '\n')
  }
  */

  const embed = new Discord.RichEmbed({ fields, video: options.video || url })
    .setTitle(title)
    .setColor(color)
    .setDescription(description)
    .setImage(options.image || url)
    .setFooter(footer, options.avatarFooter ? bot.user.avatarURL : (options.footerIcon || ''))
    .setAuthor(author.name, author.icon, author.url)
    .setThumbnail(options.thumbnail || '')

  const timestamp = timestampToDate(options.timestamp)
  if (timestamp) {
    embed.setTimestamp(timestamp)
  }

  return embed
}

const timestampToDate = timestamp => {
  if (timestamp === true) {
    return new Date()
  }

  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }

  return timestamp
}

/**
 * utils.formatEmbed - This is a function to format embed
 * with a predefined structure (primarily used to format
 * fields, so it is required to specify the fields)
 *
 * @param {string} [title='']
 * @param {string} [description='']
 * @param {Object} nestedFields
 * @param {Object} [options={}]
 *
 * @returns {Discord.RichEmbed}
 */
exports.formatEmbed = (title = '', description = '', nestedFields, options = {}) => {
  if (!nestedFields || typeof nestedFields !== 'object') {
    throw new Error('Nested fields info is not an object!')
  }

  const fields = nestedFields.map(parentField => {
    if (parentField.constructor.name === 'Array') {
      const temp = parentField
      parentField = {
        title: temp[0],
        fields: temp[1]
      }
    }

    switch (parentField.fields.constructor.name) {
      case 'Object':
        parentField.fields = [parentField.fields]
        break
      case 'Array':
        break
      default:
        parentField.fields = [{ value: parentField.fields }]
    }

    const tmp = {
      name: `${parentField.icon || '❯'}\u2000${parentField.title}`,
      value: parentField.fields.map(field => {
        let value = field.value !== undefined ? this.truncate(field.value.toString(), 1024) : ''
        let newField = `${field.name !== undefined ? `•\u2000${field.name ? `**${field.name}:** ` : ''}` : ''}${value}`

        if (options.code) {
          newField = bot.utils.formatCode(newField, options.code)
        }

        return newField.replace(/^ +| +?$/g, '') // t.trim();
      }).join('\n')
    }

    if (parentField.inline) {
      tmp.inline = parentField.inline
    }

    return tmp
  })

  if (options.simple) {
    let content = ''

    for (let i = 0; i < fields.length; i++) {
      content += `\n**${fields[i].name}:**\n${fields[i].value}`
    }

    if (options.footer) {
      content += `\n*${options.footer}*`
    }

    return content.trim()
  }

  delete options.code
  delete options.simple
  return this.embed(title, description, fields, options)
}

exports.buildSections = (children, delimeter, maxSections = 25) => {
  const sections = []
  let temp = []
  for (const child of children) {
    if (!child) {
      continue
    }

    const expectedLength = temp.join(delimeter)
      ? temp.join(delimeter).length + delimeter.length + child.length
      : child.length
    if (expectedLength > 1024) {
      sections.push(temp)
      temp = []
    }

    temp.push(child.trim())
  }
  sections.push(temp)

  sections.length = Math.min(25, Math.min(maxSections, sections.length))
  // Truncate sections one last time as a failsafe in case there
  // were instances of children that were longer than 1024 characters
  return sections.map(section => {
    const s = section.join(delimeter)
    return s.length > 1024 ? this.truncate(s, 1024) : s
  })
}

exports.formatLargeEmbed = (title = '', description = '', values, options = {}) => {
  if (!values || typeof values !== 'object') {
    throw new Error('Values info is not an object!')
  }

  if (!values.delimeter || !values.children) {
    throw new Error('Missing required properties from values info!')
  }

  const embed = this.embed(title, description, [], options)

  const sections = this.buildSections(values.children, values.delimeter)
  for (const section of sections) {
    embed.addField(values.sectionTitle || '---', section, true)
  }

  return embed
}

exports.parseArgs = (args, options) => {
  if (!options) {
    return args
  }

  if (typeof options === 'string') {
    options = [options]
  }

  const optionValues = {}

  let i
  for (i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('-')) {
      break
    }

    const label = arg.substr(1)

    if (options.indexOf(label + ':') > -1) {
      const leftover = args.slice(i + 1).join(' ')
      const matches = leftover.match(/^"(.+?)"/)
      if (matches) {
        optionValues[label] = matches[1]
        i += matches[0].split(' ').length
      } else {
        i++
        optionValues[label] = args[i]
      }
    } else if (options.indexOf(label) > -1) {
      optionValues[label] = true
    } else {
      break
    }
  }

  return {
    options: optionValues,
    leftover: args.slice(i)
  }
}

exports.multiSend = async (channel, messages, delay) => {
  try {
    for (const m of messages) {
      // console.log(m.length)
      await channel.send(m)
      await this.sleep(delay || 200)
    }
  } catch (err) {
    throw err
  }
}

exports.sendLarge = async (channel, largeMessage, options = {}) => {
  let message = largeMessage
  const messages = []
  const prefix = options.prefix || ''
  const suffix = options.suffix || ''

  const max = 2000 - prefix.length - suffix.length

  while (message.length >= max) {
    let part = message.substr(0, max)
    let cutTo = max
    if (options.cutOn) {
      /* Prevent infinite loop where lastIndexOf(cutOn) is the first char
       * in `part`. Later, we will correct by +1 since we did lastIndexOf on all
       * but the first char in `part`. We *dont* correct immediately, since if
       * cutOn is not found, cutTo will be -1 and we dont want that to become 0.
      */
      cutTo = part.slice(1).lastIndexOf(options.cutOn)

      // Prevent infinite loop when cutOn isnt found in message
      if (cutTo === -1) {
        cutTo = max
      } else {
        // Correction necessary from a few lines above
        cutTo += 1

        if (options.cutAfter) {
          cutTo += 1
        }

        part = part.substr(0, cutTo)
      }
    }
    messages.push(prefix + part + suffix)
    message = message.substr(cutTo)
  }

  if (message.length > 1) {
    messages.push(prefix + message + suffix)
  }

  return this.multiSend(channel, messages, options.delay)
}

exports.playAnimation = async (msg, delay, list) => {
  if (list.length < 1) {
    return
  }

  const next = list.shift()
  const start = this.now()

  try {
    await msg.edit(next)
    const elapsed = this.now() - start
    setTimeout(() => this.playAnimation(msg, delay, list), Math.max(50, delay - elapsed))
  } catch (err) {
    msg.error(err)
  }
}

exports.now = () => {
  const now = process.hrtime()
  return now[0] * 1e3 + now[1] / 1e6
}

exports.fromNow = date => {
  if (!date) {
    return false
  }

  const ms = new Date().getTime() - date.getTime()

  if (ms >= 86400000) {
    const days = Math.floor(ms / 86400000)
    return `${days} day${days !== 1 ? 's' : ''} ago`
  }

  return `${this.humanizeDuration(ms, 1, false, false)} ago`
}

exports.humanizeDuration = (ms, maxUnits, short = false, fraction = true) => {
  const round = ms > 0 ? Math.floor : Math.ceil
  const parsed = [
    {
      int: round(ms / 604800000), sin: 'week', plu: 'weeks', sho: 'w'
    },
    {
      int: round(ms / 86400000) % 7, sin: 'day', plu: 'days', sho: 'd'
    },
    {
      int: round(ms / 3600000) % 24, sin: 'hour', plu: 'hours', sho: 'h'
    },
    {
      int: round(ms / 60000) % 60, sin: 'minute', plu: 'minutes', sho: 'm'
    },
    {
      int: (round(ms / 1000) % 60) + (round(ms) % 1000 / 1000),
      sin: 'second',
      plu: 'seconds',
      sho: 's'
    }
  ]

  const result = []
  for (let i = 0; i < parsed.length; i++) {
    if (!result.length && parsed[i].int === 0) {
      continue
    }

    if (result.length >= maxUnits) {
      break
    }

    let int = parsed[i].int
    if (!result.length && fraction && i === parsed.length - 1) {
      int = int.toFixed(1)
    } else {
      int = int.toFixed(0)
    }

    result.push(`${int}${short ? parsed[i].sho : ' ' + (parseFloat(int) !== 1 ? parsed[i].plu : parsed[i].sin)}`)
  }

  return result.map((res, i) => {
    if (!short) {
      if (i === result.length - 2) {
        return res + ' and'
      } else if (i !== result.length - 1) {
        return res + ','
      }
    }
    return res
  }).join(' ')
}

exports.formatSeconds = ms => {
  const s = ms / 1000
  return `${s} second${s !== 1 ? 's' : ''}`
}

exports.getProp = (obj, props) => {
  if (!obj || !props) return

  if (typeof props === 'string') {
    if (props.includes('.')) {
      const propsArr = props.split('.')
      props = []

      for (let i = 0; i < propsArr.length; i++) {
        let p = propsArr[i]

        while (p[p.length - 1] === '\\' && propsArr[i + 1] !== undefined) {
          p = p.slice(0, -1) + '.'
          p += propsArr[++i]
        }

        props.push(p)
      }
    } else {
      props = [props]
    }
  } else if (!props.constructor || props.constructor.name !== 'Array') {
    return
  }

  for (let i = 0; i < props.length; i++) {
    obj = obj[props[i]]

    if (obj === undefined) {
      break
    }
  }

  return obj
}

/**
 * utils.getMsg - A Promise which will return a cached message from a
 * channel. If msgId is not provided, then it will return the previous
 * message. Optionally, it can also be asked to fetch message instead.
 *
 * @param {(Discord.TextChannel|Discord.DMChannel)} channel
 * @param {number} [msgId]
 * @param {number} [curMsg]
 *
 * @returns {Discord.Message}
 */
exports.getMsg = async (channel, msgId, curMsg) => {
  if (!(channel instanceof Discord.TextChannel || channel instanceof Discord.DMChannel)) {
    throw new Error('An instance of Discord.TextChannel or Discord.DMChannel is required!')
  }

  if (msgId && isNaN(parseInt(msgId))) {
    throw new Error('Invalid message ID. It must be numbers!')
  }

  const foundMsg = channel.messages.get(msgId || channel.messages.keyArray()[channel.messages.size - 2])

  if (!foundMsg && curMsg) {
    try {
      const msgs = await channel.fetchMessages({
        limit: 1,
        around: msgId,
        before: curMsg
      })

      if (msgs.size < 1 || (msgId ? msgs.first().id !== msgId : false)) {
        throw new Error('Message could not be fetched from the channel!')
      }

      return msgs.first()
    } catch (err) {
      throw err
    }
  } else if (foundMsg) {
    return foundMsg
  } else {
    throw new Error('Message could not be found in the channel!')
  }
}

const formatFoundList = (collection, props, name) => {
  const MAX = 20
  const isMoreThanMax = collection.size > 20
  const leftover = isMoreThanMax && collection.size - 20

  const array = collection.sort((a, b) => this.getProp(a, props).localeCompare(this.getProp(b, props))).array()
  array.length = Math.min(MAX, array.length)

  return new Error(`Found \`${collection.size}\` ${name}${collection.size !== 1 ? 's' : ''} with that keyword. ` +
    'Please use a more specific keywords!\n' +
    bot.utils.formatCode(`${array.map(i => this.getProp(i, props)).join(', ')}` +
    `${isMoreThanMax ? `, and ${leftover} more\u2026` : ''}`))
}

exports.getGuildMember = (guild, keyword, fallback, suppress) => {
  if (keyword) {
    if (!(guild instanceof Discord.Guild)) {
      throw new Error('An instance of Discord.Guild is required!')
    }

    keyword = keyword.trim()

    const execMention = /^<@!?(\d+?)>$/.exec(keyword)
    if (execMention) {
      const get = guild.members.get(execMention[1])
      if (get) {
        // 2nd element in array is an indicator that the keyword was a mention
        return [get, true]
      }
    }

    const testId = /^\d+$/.test(keyword)
    if (testId) {
      const get = guild.members.get(keyword)
      if (get) {
        return [get, false]
      }
    }

    const testTag = /#\d{4}$/.test(keyword)
    if (testTag) {
      const find = guild.members.find(m => m.user && m.user.tag === keyword)
      if (find) {
        return [find, false]
      }
    }

    const regex = new RegExp(keyword, 'i')
    const filter = guild.members.filter(m => {
      return (m.nickname && regex.test(m.nickname)) || (m.user && m.user.username && regex.test(m.user.username))
    })
    if (filter.size === 1) {
      return [filter.first(), false]
    } else if (filter.size !== 0) {
      throw formatFoundList(filter, 'user.tag', 'guild member')
    }
  }

  if (fallback && !keyword) {
    return [fallback, false]
  }

  if (!suppress) {
    throw new Error('Guild member with that keyword could not be found!')
  }
}

exports.getUser = (guild, keyword, fallback) => {
  if (keyword) {
    if (guild) {
      const member = this.getGuildMember(guild, keyword, null, true)
      if (member) {
        return [member[0].user, member[1]]
      }
    }

    keyword = keyword.trim()

    const execMention = /^<@!?(\d+?)>$/.exec(keyword)
    if (execMention) {
      const get = bot.users.get(execMention[1])
      if (get) {
        // 2nd element in array is an indicator that the keyword was a mention
        return [get, true]
      }
    }

    const testId = /^\d+$/.test(keyword)
    if (testId) {
      const get = bot.users.get(keyword)
      if (get) {
        return [get, false]
      }
    }

    const testTag = /#\d{4}$/.test(keyword)
    if (testTag) {
      const find = bot.users.find(u => u.tag === keyword)
      if (find) {
        return [find, false]
      }
    }

    const regex = new RegExp(keyword, 'i')
    const filter = bot.users.filter(u => u.username && regex.test(u.username))
    if (filter.size === 1) {
      return [filter.first(), false]
    } else if (filter.size !== 0) {
      throw formatFoundList(filter, 'tag', 'user')
    }
  }

  if (fallback && !keyword) {
    return [fallback, false]
  }

  throw new Error('User with that keyword could not be found!')
}

exports.getGuildRole = (guild, keyword) => {
  if (!(guild instanceof Discord.Guild)) {
    throw new Error('An instance of Discord.Guild is required!')
  }

  keyword = keyword.trim()

  const execMention = /<@&?(\d+?)>/g.exec(keyword)
  if (execMention) {
    const get = guild.roles.get(execMention[1])
    if (get) {
      // 2nd element in array is an indicator that the keyword was a mention
      return [get, true]
    }
  }

  const testId = /^\d+$/.test(keyword)
  if (testId) {
    const get = guild.roles.get(keyword)
    if (get) {
      return [get, false]
    }
  }

  const find = guild.roles.find(r => r.name === keyword)
  if (find) {
    return [find, false]
  }

  const regex = new RegExp(keyword, 'i')
  const filter = guild.roles.filter(r => regex.test(r.name))
  if (filter.size === 1) {
    return [filter.first(), false]
  } else if (filter.size !== 0) {
    throw formatFoundList(filter, 'name', 'guild role')
  }

  throw new Error('Guild role with that keyword could not be found!')
}

exports.getGuild = (keyword, suppress) => {
  keyword = keyword.trim()

  const testId = /^\d+$/.test(keyword)
  if (testId) {
    const get = bot.guilds.get(keyword)
    if (get) return get
  }

  const find = bot.guilds.find(g => g.name === keyword)
  if (find) return find

  const regex = new RegExp(keyword, 'i')
  const filter = bot.guilds.filter(g => regex.test(g.name))
  if (filter.size === 1) {
    return filter.first()
  } else if (filter.size !== 0) {
    throw formatFoundList(filter, 'name', 'guild')
  }

  if (!suppress) {
    throw new Error('Guild with that keyword could not be found!')
  }
}

exports.getChannel = (keyword, guild, strict = false) => {
  if (!keyword) return false

  keyword = keyword.trim()

  const testId = /^\d+$/.test(keyword)
  if (testId) {
    const get = bot.channels.get(keyword)
    if (get) return get
  }

  const testMatch = keyword.match(/^<#(\d+?)>$/)
  if (testMatch) {
    const get = bot.channels.get(testMatch[1])
    if (get) return get
  }

  if (guild) {
    const find = guild.channels.find(c => c.name === keyword)
    if (find) return find

    const regex = new RegExp(keyword, 'i')
    const filter = guild.channels.filter(c => regex.test(c.name))
    if (filter.size === 1) {
      return filter.first()
    } else if (filter.size !== 0) {
      throw formatFoundList(filter, 'name', 'guild channel')
    }
  }

  if (!guild || !strict) {
    const channels = bot.channels.filter(c => c.type === 'dm')

    const testId = /^\d+$/.test(keyword)
    if (testId) {
      const get = channels.get(keyword)
      if (get) return get
    }

    const testTag = /#\d{4}$/.test(keyword)
    if (testTag) {
      const find = channels.get(c => c.recipient && c.recipient.tag && regex.test(c.recipient.tag))
      if (find) return find
    }

    const find = channels.find(c => c.recpient && c.recipient.username === keyword)
    if (find) return find

    const regex = new RegExp(keyword, 'i')
    const filter = channels.filter(c => c.recipient && c.recipient.username && regex.test(c.recipient.username))
    if (filter.size === 1) {
      return filter.first()
    } else if (filter.size !== 0) {
      throw formatFoundList(filter, 'recipient.tag', 'DM channel')
    }
  }

  throw new Error('Channel with that keyword could not be found!')
}

exports.pad = (pad, str, padLeft) => {
  if (typeof str === 'undefined') {
    return pad
  }

  return padLeft ? (pad + str).slice(-pad.length) : (str + pad).substring(0, pad.length)
}

exports.getHostName = url => {
  const match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i)

  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2]
  }

  return false
}

exports.fetchGuildMembers = async (guild, cache = false) => {
  if (!(guild instanceof Discord.Guild)) {
    throw new Error('An instance of Discord.Guild is required!')
  }

  if (cache) {
    return { guild, time: '' }
  }

  const beginTime = process.hrtime()
  try {
    const g = await guild.fetchMembers()
    const elapsedTime = process.hrtime(beginTime)
    const elapsedTimeNs = elapsedTime[0] * 1e9 + elapsedTime[1]
    return {
      guild: g,
      time: this.formatTimeNs(elapsedTimeNs),
      ns: elapsedTimeNs
    }
  } catch (err) {
    throw err
  }
}

const pasteName = () => {
  return `lightbringer_${new Date().getTime()}`
}

const pasteFooter = `Uploaded with Lightbringer v${require('../package.json').version} – ` +
  'https://github.com/BobbyWibowo/Lightbringer.\nYet another Discord self-bot written with discord.js.'

exports.haste = async (content, suffix = '', raw = false) => {
  try {
    const res = await snekfetch.post('https://hastebin.com/documents').send(content + `\n\n${pasteFooter}`)
    if (res.status !== 200) {
      throw new Error('Could not connect to hastebin server!')
    }

    return `https://hastebin.com/${raw ? 'raw/' : ''}${res.body.key}${suffix ? `.${suffix}` : ''}`
  } catch (err) {
    throw err
  }
}

exports.paste = async (content, options = {}) => {
  const pastebinRegex = /^https?:\/\/pastebin\.com\/(\w+?)$/
  const CONFIG_KEY_DEV = 'pastebinApiDevKey'
  const CONFIG_KEY_USER = 'pastebinApiUserKey'

  if (!bot.config[CONFIG_KEY_DEV]) {
    throw new Error(`Pastebin API dev key (\`${CONFIG_KEY_DEV}\`) is missing from config.json file!`)
  }

  const name = options.name || pasteName()
  const format = options.format || 'text'
  const privacy = parseInt(options.privacy) || 1
  const expiration = options.expiration || 'N'

  try {
    const res = await snekfetch.post('https://pastebin.com/api/api_post.php')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send({
        api_dev_key: bot.config[CONFIG_KEY_DEV],
        api_option: 'paste',
        api_paste_code: content + `\n\n${pasteFooter}`,
        api_user_key: bot.config[CONFIG_KEY_USER] || '',
        api_paste_name: name,
        api_paste_format: format,
        api_paste_private: privacy,
        api_paste_expire_date: expiration
      })
    if (res.status !== 200) {
      throw new Error('Unexpected error occurred!')
    }
    const result = res.body.toString()
    if (!pastebinRegex.test(result)) {
      throw new Error(result)
    }
    return options.raw ? `https://pastebin.com/raw/${pastebinRegex.exec(result)[1]}` : result
  } catch (err) {
    throw err
  }
}

exports.gists = async (content, options = {}) => {
  const snekpost = snekfetch.post('https://api.github.com/gists')
  const CONFIG_TOKEN = 'githubGistsToken'

  if (bot.config[CONFIG_TOKEN]) {
    snekpost.set('Authorization', `token ${bot.config[CONFIG_TOKEN]}`)
  }

  if (!options.suffix || options.suffix === 'md') {
    content = content.replace(/\n/g, '  \n')
  }

  try {
    const res = await snekpost.send({
      description: pasteFooter.replace(/\n/g, ' '),
      public: options.public || false,
      files: {
        [options.name || `${pasteName()}.${options.suffix || 'md'}`]: {
          content
        }
      }
    })
    if (!res.body || !res.body.html_url) {
      throw new Error('Unexpected error occurred!')
    }
    return res.body.html_url
  } catch (err) {
    throw err
  }
}

/* Powerful emojis array builder. Unfortunately,
 * regex for regular emojis is somewhat broken…
 * I'll look into a better RegEx later. */
exports.buildEmojisArray = (source, options = {}) => {
  const customEmojiRegex = /<:\w+?:(\d+?)>/
  const regionalRegex = /[a-z0-9#*!?]/
  const allEmojiRegex = new RegExp(`${emojiRegex.source}|${customEmojiRegex.source}|${regionalRegex.source}|.`, 'gi')

  const result = []
  const matches = source.match(allEmojiRegex)

  const isCustomEmojiUsable = e => {
    // If the array must return an array of unique individual emojis and the said emoji is already within the array
    if (options.unique && result.includes(e)) {
      return false
    }

    // If the emoji is an object (meaning it is most likely an instance of Discord.Emoji instead of regular string)
    if (typeof e === 'object') {
      // If the user is NOT Nitro, the emoji is NOT global and the emoji is NOT the guild's local emoji
      if (!bot.user.premium && !e.managed && e.guild !== options.guild) {
        return false
      }
      // If the array must NOT include external emojis and the emoji is NOT the guild's local emoji
      if (!options.external && e.guild !== options.guild) {
        return false
      }
    }

    // Otherwise ...
    return true
  }

  if (matches && matches.length) {
    for (const m of matches) {
      if (options.max && result.length >= options.max) {
        break
      }

      if (m.match(new RegExp(`^${regionalRegex.source}$`, 'i'))) {
        const emojiMap = bot.consts.emojiMap[m]
        if (!emojiMap) {
          continue
        }

        const t = typeof emojiMap
        if (t === 'object') {
          for (let e of emojiMap) {
            if (e.match(/^\d*?$/)) e = bot.emojis.find('id', e)
            if (isCustomEmojiUsable(e)) {
              result.push(e)
              break
            }
          }
        } else if (t === 'string') {
          result.push(emojiMap)
        }
        continue
      }

      const customEmoji = m.match(new RegExp(`^${customEmojiRegex.source}`, 'i'))
      if (customEmoji && customEmoji[1]) {
        const e = bot.emojis.find('id', customEmoji[1])
        if (isCustomEmojiUsable(e)) {
          result.push(e)
        }
        continue
      }

      if (m.match(emojiRegex)) {
        result.push(m)
        continue
      }

      if (options.preserve) {
        result.push(m)
      }
    }
  }

  return result
}

exports.searchMessages = async (guild, options = {}) => {
  if (!guild || !(guild instanceof Discord.Guild) || !options.content || isNaN(parseInt(options.max))) {
    return []
  }

  options.excludes = options.excludes || []
  options._limit = options.max + options.excludes.length
  const pages = Math.floor((options._limit - 1) / 25)
  const messages = []

  try {
    return new Promise((resolve, reject) => {
      const s = async i => {
        options.limit = Math.min(25, options._limit)

        let array
        try {
          array = await guild.search(options)
        } catch (err) {
          return reject(err)
        }

        array.messages.forEach(cluster => {
          cluster.forEach(msg => {
            return msg.hit && !options.excludes.includes(msg.id) && messages.push(msg)
          })
        })

        if (i === pages) {
          const sorted = messages.sort((a, b) => b.createdTimestamp - a.createdTimestamp)
          sorted.length = Math.min(options.max, sorted.length)
          return resolve(sorted)
        }

        options.offset++
        options._limit -= 25
        s(i + 1)
      }
      options.offset = 0
      s(0)
    })
  } catch (err) {
    throw err
  }
}

exports.getGuildColor = async guild => {
  if (!guild.icon) {
    return [0, 0, 0]
  }

  const saved = this.guildColors.get(guild.id)
  if (saved && saved.icon === guild.icon) {
    return saved.color
  }

  try {
    return new Promise((resolve, reject) => {
      pixelAverage(guild.iconURL, (err, avgs) => {
        if (err) {
          return reject(err)
        }

        const color = [Math.floor(avgs.red), Math.floor(avgs.green), Math.floor(avgs.blue)]
        this.guildColors.set(guild.id, { icon: guild.icon, color })
        this.guildColors.save()
        return resolve(color)
      })
    })
  } catch (err) {
    throw err
  }
}

exports.channelName = channel => {
  if (channel.type === 'dm') {
    return `DM with ${channel.recipient.tag}`
  } else if (channel.type === 'text') {
    return `#${channel.name} (ID: ${channel.id})`
  } else {
    return `${channel.type.toUpperCase()} - ${channel.name}`
  }
}

exports.cleanUrl = url => {
  return encodeUrl(url.replace(/ /g, '+')).replace(/\(/g, '%40').replace(/\)/g, '%41')
}

exports.formatYesNo = bool => {
  if (bool) {
    return 'yes'
  } else {
    return 'no'
  }
}

exports.formatCode = (text, lang = '', inline = false) => {
  if (inline) {
    return `\`${text}\`` // `${text}`
  } else {
    return `\`\`\`${lang}\n${text}\n\`\`\`` // ```${lang}${text}\n```
  }
}

exports.escapeMarkdown = content => {
  return content.replace(/(\\|`|\*|_|{|}|\[|]|\(|\)|\+|-|\.|!|>|~)/g, '\\$1')
}

exports.formatTimeNs = ns => {
  if (ns < 1e9) {
    return `${(ns / 1e6).toFixed(3)} ms`
  } else {
    return `${(ns / 1e9).toFixed(3)} s`
  }
}

exports.cleanCustomEmojis = text => {
  if (text) {
    return text.replace(/<(:\w+?:)\d+?>/g, '$1')
  } else {
    return ''
  }
}

exports.capitalizeFirstLetter = input => {
  const sentences = input.split('. ')
  return sentences.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('. ')
}

exports.sleep = duration => {
  return new Promise(resolve => setTimeout(() => resolve(), duration))
}
