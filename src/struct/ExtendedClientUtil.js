const { ClientUtil } = require('discord-akairo')
const { MessageEmbed } = require('discord.js')
const moment = require('moment')
const { resolveColor } = require('discord.js').Util

const R_USER = /^<@!?(\d+?)>$/
const R_ROLE = /^<@&?(\d+?)>$/
const R_CHANNEL = /^<#(\d+?)>$/

class ExtendedClientUtil extends ClientUtil {
  constructor (client) {
    super(client)

    this.isClientUtilExtended = true
  }

  embed (data) {
    // If data Object exists, attempt
    // to apply some extended behavior
    if (data) {
      // ColorResolvable to number
      if (data.color !== undefined) {
        data.color = resolveColor(data.color)
      }

      // Apply default 'inline' property if available
      // to fields that do not have them
      if (data.inline !== undefined) {
        if (data.fields !== undefined) {
          for (let i = 0; i < data.fields.length; i++) {
            if (data.fields[i].inline === undefined) {
              data.fields[i].inline = data.inline
            }
          }
          delete data.inline
        }
      }

      // String to its proper Object equivalent
      if (typeof data.author === 'string') {
        data.author = { name: data.author }
      }

      if (typeof data.footer === 'string') {
        data.footer = { text: data.footer }
      }

      if (typeof data.image === 'string') {
        data.image = { url: data.image }
      }

      if (typeof data.thumbnail === 'string') {
        data.thumbnail = { url: data.thumbnail }
      }

      // Move value of author's icon property
      // to author's iconURL property
      if (data.author.icon !== undefined) {
        data.author.iconURL = data.author.icon
        delete data.author.icon
      }
    }

    return new MessageEmbed(data)
  }

  hasEmbedPermission (channel) {
    if (channel.guild) {
      return channel.permissionsFor(channel.guild.me).has('EMBED_LINKS')
    } else {
      return true
    }
  }

  getProp (object, props) {
    if (!object || !props) return

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
      object = object[props[i]]

      if (object === undefined) {
        break
      }
    }

    return object
  }

  humanizeDuration (ms, maxUnits, short, fraction = true) {
    const round = ms > 0 ? Math.floor : Math.ceil
    const parsed = [
      {
        name: 'week',
        int: round(ms / 604800000)
      },
      {
        name: 'day',
        int: round(ms / 86400000) % 7
      },
      {
        name: 'hour',
        int: round(ms / 3600000) % 24
      },
      {
        name: 'minute',
        int: round(ms / 60000) % 60
      },
      {
        name: 'second',
        int: (round(ms / 1000) % 60) + (round(ms) % 1000 / 1000)
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

      let substring = int + ' '
      if (short) {
        substring += parsed[i].name.charAt(0)
      } else {
        substring += parsed[i].name
        if (parseFloat(int) !== 1) substring += 's'
      }

      result.push(substring)
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

  fromNow (date) {
    if (!date) return false

    const ms = new Date().getTime() - date.getTime()

    if (ms >= 86400000) {
      const days = Math.floor(ms / 86400000)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    }

    return `${this.humanizeDuration(ms, 1, false, false)} ago`
  }

  formatFromNow (date) {
    return `${moment(date).format('ddd, MMM Do YYYY @ h:mm:ss a')} (${this.fromNow(date)})`
  }

  formatCode (text, lang = '', inline = false) {
    if (inline) {
      return `\`${text}\`` // `${text}`
    } else {
      return `\`\`\`${lang}\n${text}\n\`\`\`` // ```${lang}${text}\n```
    }
  }

  formatTimeNs (timeNs) {
    if (timeNs < 1e9) {
      const timeMs = timeNs / 1e6
      if (timeMs >= 100) {
        return `${timeMs.toFixed(1)} ms`
      } else {
        return `${timeMs.toFixed(3)} ms`
      }
    } else {
      return `${(timeNs / 1e9).toFixed(3)} s`
    }
  }

  capitalizeFirstLetter (input) {
    const sentences = input.split('. ')
    return sentences.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('. ')
  }

  isKeywordMentionable (keyword, type) {
    if (type === 1) return R_ROLE.test(keyword)
    if (type === 2) return R_CHANNEL.test(keyword)
    return R_USER.test(keyword)
  }

  formatYesNo (isYes) {
    return isYes ? 'yes' : 'no'
  }

  getHostName (url) {
    const match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i)
    return match ? match[2] : ''
  }
}

module.exports = ExtendedClientUtil