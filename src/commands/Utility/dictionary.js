const { CollegiateDictionary, WordNotFoundError } = require('mw-dict')

const CONFIG_KEY_DICT = 'merriamWebsterDictKey'

exports.init = async bot => {
  if (bot.config[CONFIG_KEY_DICT]) {
    await initDictClient()
  }
}

const initDictClient = async () => {
  this.dictClient = await new CollegiateDictionary(bot.config[CONFIG_KEY_DICT])
  return true
}

exports.run = async (bot, msg, args) => {
  if (!bot.config[CONFIG_KEY_DICT]) {
    return msg.error(`Merriam-Webster Dictionary key (\`${CONFIG_KEY_DICT}\`) is missing from config.json file!`)
  }

  if (!this.dictClient) {
    await initDictClient()
  }

  if (msg.guild) {
    bot.utils.assertEmbedPermission(msg.channel, msg.member)
  }

  const parsed = bot.utils.parseArgs(args, ['i:', 'nm'])

  if (!parsed.leftover.length) {
    return msg.error('You must specify something to search!')
  }

  const query = parsed.leftover.join(' ')
  const y = 'Merriam-Webster'

  await msg.edit(`${PROGRESS}Searching for \`${query}\` on ${y}\u2026`)

  let resp
  try {
    resp = await this.dictClient.lookup(query)
  } catch (err) {
    if (err instanceof WordNotFoundError) {
      return msg.edit(`${FAILURE}\`${query}\` was not found!`, {
        embed: bot.utils.embed(
          `Suggestions`,
          err.suggestions.join('; '),
          [],
          {
            footer: y,
            color: '#ff0000'
          }
        )
      })
    } else {
      throw new Error(err)
    }
  }

  let index = 0
  if (parsed.options.i) {
    index = parseInt(parsed.options.i)

    if (isNaN(index)) {
      return msg.error('Index must be a number!')
    } else {
      index--
    }
  }

  const selected = resp[index]
  const nestedFields = [
    ['Link', `**https://www.merriam-webster.com/dictionary/${selected.word.replace(/ /g, '+')}**`]
  ]

  if (resp.length > 1 && !parsed.options.nm) {
    nestedFields.push([
      'More',
      resp.map((r, i) => i !== index ? `**${i + 1}** : ${r.word}` : false).filter(r => r).join('\n') +
      '\n\n*Use -i <index> to display definition of search result with a specific index.*'
    ])
  }

  const embed = bot.utils.formatEmbed(
    `${selected.word}${selected.functional_label ? ` (${selected.functional_label})` : ''}`,
    selected.definition.map(d => {
      // All instances of .filter(d => d) used to filter out 'false' from skipping object in line 102
      if (d.meanings) {
        return _beautify(d, selected.word)
      } else if (d.senses) {
        return `**${d.number}** :\n${d.senses.map(s => {
          const t = _beautify(s, selected.word)
          return t ? `    ${t}` : t
        }).filter(d => d).join('\n')}`
      } else {
        console.log(require('util').inspect(d))
        return '**Unexpected behavior for this definition. Check your console\u2026**'
      }
    }).filter(d => d).join('\n'),
    nestedFields,
    {
      footer: `${y}'s Collegiate® Dictionary`,
      footerIcon: 'https://a.safe.moe/jGuCr.png',
      color: '#2d5f7c'
    }
  )

  return msg.edit(
    `Search result of \`${query}\` at index \`${index + 1}/${resp.length}\` on ${y}:`,
    { embed }
  )
}

const _beautify = (m, word) => {
  if (!m.meanings) {
    console.warn(require('util').inspect(m))
    console.warn('[dictionary] Skipping the above Sense object\u2026')
    return false
  }

  console.log(require('util').inspect(m))

  // These can be improved even further, I think
  // But oh well, these will do for now

  let _temp = m.number ? `**${m.number}**${m.status ? ` *${m.status}*` : ''} ` : ''

  _temp += m.meanings.map((m, i, a) => {
    // Trim whitespaces (some meanings have unexpected whitespace)
    m = m.trim()

    if (m.includes(':')) {
      // Format semicolons
      m = m.split(':').map(m => m.trim()).join(' : ').trim()
    } else {
      // Italicizes if the meaning does not start with a colon (:)
      m = `*${m}*`
    }

    // Starts meaning with a semicolon (;) if it does not start with
    // a colon (:) and there was a precedent meaning
    if (!m.startsWith(':') && a[i - 1] !== undefined) {
      m = `; ${m}`
    }

    return m
  }).join(' ')

  if (m.synonyms) {
    // Adds an extra whitespace if there was
    // a meaning that ends with semicolon (;)
    if (_temp.endsWith(':')) {
      _temp += ' '
    }

    // Underlines all synonyms
    _temp += m.synonyms.map(s => `__${s}__`).join(', ')
  }

  if (m.illustrations) {
    _temp += ' ' + m.illustrations.map(i => `\u2022 ${i}`).join(' ')
  }

  return _temp.replace(new RegExp(`\\b${word}\\b`), `*${word}*`).trim()
}

exports.info = {
  name: 'dictionary',
  usage: 'dictionary [-i] <query>',
  description: 'Looks up a word on Merriam-Webster',
  aliases: ['dict'],
  options: [
    {
      name: '-i',
      usage: '-i <index>',
      description: 'Sets index of which definition to show'
    },
    {
      name: '-nm',
      usage: '-nm',
      description: 'Prevents the bot from adding More field which will usually list the rest of the search results if available'
    }
  ]
}
