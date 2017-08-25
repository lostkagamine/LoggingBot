/*
    LoggingBot Rewrite
    (c) ry00000/ry00001 2017
    Reach me on Discord! ry00001#3487
    This is FOSS (Free and Open Source Software)
    You may do whatever you please with this software (crediting the original author)
*/
const Discord = require("discord.js")
const r = require("rethinkdb")
const sa = require("superagent")
const config = require("./config.json")
const p = require("process")
const c_p = require("child_process")
const util = require('util')
const prefix = "l!"
const bot = new Discord.Client()
const embeds = {
    "ban": {
        "color": 0xFF0000,
        "title": "Member Banned"
    },
    "unban": {
        "color": 0x5555FF,
        "title": "Member Unbanned"
    },
    "kick": {
        "color": 0xFFA500,
        "title": "Member Kicked"
    }
}
bot.on("ready", ()=> {
    console.log(`LoggingBot II connected to Discord.\nLogged in as ${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`)
})

function doLoggingEmbed(type, g, u) {
    let caseid = r.table("cases").filter({gid: g.id}).count().run(conn).then(a => {
        console.log(a)
        a = a + 1
        r.table('guilds').filter({gid: g.id}).run(conn).then(obj => {
            obj = obj.next().then(aaa => {
                g.fetchAuditLogs({limit:10, type:type}).then(audit => {
                    if (u instanceof Discord.GuildMember) u = u.user
                    // console.log(util.inspect(audit))
                    let mod = audit.entries.first().executor
                    let modinfo = {username: mod.username, discrim: mod.discriminator, tag: mod.tag, id: mod.id}
                    let embed = new Discord.RichEmbed(
                        {
                            color: embeds[type]['color'],
                            title: embeds[type]['title'],
                            description: `Case ${a}`
                        }
                    )
                    .addField('Moderator', mod.tag)
                    // .setDescription(`Case ${a}`)
                    .addField('Target', `**${u.username}**#${u.discriminator} (${u.id})`)
                    if (audit.entries.first().reason) { embed.addField('Reason', `${audit.entries.first().reason}`, false)} else {
                        embed.addField('Reason', `${mod}, type \`${prefix}reason ${a} <reason>\` to set a reason.`, false)
                    }
                    reason = audit.entries.first().reason ? audit.entries.first().reason : 'none'
                    g.channels.get(aaa.channel).send('', {embed: embed}).then(message => {
                        r.table("cases").insert({
                            type: type,
                            gid: g.id,
                            target: {id: u.id, tag: u.tag, username: u.username, discrim: u.discriminator},
                            mod: modinfo,
                            ogmod: modinfo,
                            case_id: a,
                            reason: reason,
                            msgid: message.id
                        }).run(conn)
                    })
                    delete(embed)
                })
            })
        })
    })
}

bot.on("guildBanAdd", (g, u) => {
    doLoggingEmbed('ban', g, u)
})

bot.on("guildBanRemove", (g, u) => {
    doLoggingEmbed('unban', g, u)
})

bot.on('guildMemberRemove', u => {
    u.guild.fetchAuditLogs({limit: 10, type: 'kick'}).then(audit => {
        audit = audit.entries.first()
        // console.log(util.inspect(audit))
        if (audit.action == 'MEMBER_KICK' && audit.target == u.user) {
            doLoggingEmbed('kick', u.guild, u)
        }
    })
})


bot.on("message", msg => {
    try {
        if (msg.author.bot) { return;}
        if (!msg.content.startsWith(prefix)) { return;}
        let cmd = msg.content.split(" ")[0]
        cmd = cmd.slice(prefix.length)
        let args = msg.content.split(" ").slice(1)
        if ((cmd == "eval" || cmd == "ev" || cmd == "e") && msg.author.id == config.owner) {
            let res
            let embed = new Discord.RichEmbed()
            .setColor(0x00FF00)
            .setTitle("LoggingBot II Eval")
            .addField("Input", "```js\n" + args.join(" ") + "```")
            .setFooter(msg.author.tag + " | " + new Date().toUTCString(), msg.author.displayAvatarURL)
            try {
                res = eval(args.join(" "))
            } catch (e) {
                embed.addField("Error", `\`\`\`\n${e}\`\`\``)
                embed.setColor(0xFF0000)
                return msg.channel.send("", {embed: embed})
            }
            embed.addField("Result", `\`\`\`\n${res}\`\`\``)
            msg.channel.send("", {embed: embed})
        }
        if (cmd == "setup") {
            if (msg.author.id != config.owner) {
                if (!msg.member.hasPermission("MANAGE_GUILD")) {
                    msg.channel.send(":x: Invalid permissions.")
                    return
                }
            }
            let filter = m => m.mentions.channels.first() && m.author.id == msg.author.id && m.channel.id == msg.channel.id
            msg.channel.send("Mention the channel where the mod log will go.")
            msg.channel.awaitMessages(filter, {max: 1, time:10000, errors:["time"]})
            .then(a => {
                try {
                    r.db("loggingbot2").table("guilds").insert({
                        gid: msg.guild.id,
                        channel: a.first().mentions.channels.first().id
                    }, {conflict: "update"}).run(conn)
                } catch (e) {
                    return msg.channel.send(":x: Unable to insert into database. This is a bug! Report at http://github.com/ry00000/LoggingBot/issues \n\nError details: ```\n" + e + "```")
                }
                msg.channel.send(":ok_hand:")
            }).catch(e => { 
                msg.channel.send("Cancelled")
            })
        }
        if (cmd == "ping") {
            msg.channel.send("Pong. `" + Math.floor(bot.ping) + "ms`")
        }
        if (cmd == "error" && msg.author.id == config.owner) {
            3/0
        }
        if (cmd == "reason") {
            let caseno
            caseno = parseInt(args[0])
            if (isNaN(caseno)) {
                return msg.channel.send(':x: Not a valid number.')
            }
            if (!msg.member.hasPermission("MANAGE_ROLES")) { return msg.channel.send(':x: Invalid permissions.')}
            try {
                reason = args.slice(1).join(' ')
                let modinfo = {username: msg.author.username, discrim: msg.author.discriminator, tag: msg.author.tag, id: msg.author.id}
                r.table('cases').filter({gid: msg.guild.id, case_id: caseno}).replace({reason: reason, mod: modinfo}).run(conn)
                r.table('guilds').filter({gid: msg.guild.id}).run(conn).then(obj => {
                    obj.next().then(rdbg => {
                        r.table('cases').filter({gid: msg.guild.id, case_id: caseno - 1}).run(conn).then(a => a.next().then(a => {
                                msg.guild.channels.get(rdbg.channel).fetchMessages({limit: 1, around: a.msgid}).then(m =>{ 
                                    // console.log(util.inspect(a))
                                    let embed = new Discord.RichEmbed(
                                        {
                                            color: embeds[a.type]['color'],
                                            title: embeds[a.type]['title'],
                                            description: `Case ${caseno}`
                                        }
                                    )
                                    embed.addField('Moderator', msg.author.tag, false)
                                    embed.addField('Target', `**${a.target.username}**#${a.target.discrim} (${a.target.id})`, false)
                                    embed.addField('Reason', reason, false)
                                    m.first().edit('', {embed: embed})
                                })
                            }))
                        })
                    })
            } catch (e) {
                console.log(e)
            }
        }
    if (cmd == 'resetCases') {
        if (msg.author.id != config.owner) return msg.channel.send(':no_entry_sign: You can\'t do this.')
        msg.channel.send('Are you sure you want to do this? This is **irreversible** and will delete ***everything!***\n\nType `Yes, delete everything.` to confirm. (10 seconds)')
        let filter = m => m.content == 'Yes, delete everything.' && m.channel == msg.channel && m.author == msg.author
        msg.channel.awaitMessages(filter, {max: 1, time: 10000})
        .then(e => {
            r.table('cases').delete().run(conn)
            msg.channel.send('Everything was deleted...')
        })
        .catch(() => {
            msg.channel.send('Cancelled. Phew...')
        })
    }
    } catch(e) {
        let embed = new Discord.RichEmbed().setColor(0xFF0000)
        .setTitle("An error has occurred")
        .setDescription("Unfortunately, an internal error occurred while processing your command.\nYou may report it [here](http://github.com/ry00000/LoggingBot/issues) along with the full Error Details.")
        .setURL("")
        .addField("Error Details", `\`\`\`\n${e}\`\`\``)
        .setFooter(msg.author.tag + " | " + new Date().toUTCString(), msg.author.displayAvatarURL)
        msg.channel.send('', {embed: embed})
    }
})

var conn

console.log("RethinkDB connecting")
r.connect({
    host: config.rethinkdb.host,
    port: config.rethinkdb.port,
    db: config.rethinkdb.db,
    user: config.rethinkdb.user,
    password: config.rethinkdb.password
}).then(c => {
    console.log("RethinkDB connected")
    conn = c
}).catch(e => {
    console.log("RethinkDB connection failed!\n" + e)
    p.exit(1)
})

bot.login(config.token)