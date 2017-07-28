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
const prefix = "l!"
const bot = new Discord.Client()
bot.on("ready", ()=> {
    console.log(`LoggingBot II connected to Discord.\nLogged in as ${bot.user.username}#${bot.user.discriminator} (${bot.user.id})`)
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
            if (!msg.member.hasPermission("MANAGE_GUILD")) {
                msg.channel.send(":x: Invalid permissions.")
            }
            let filter = m => m.mentions.channels.first() && m.author.id == msg.author.id && m.channel.id == msg.channel.id
            msg.channel.send("Mention the channel where the mod log will go.")
            msg.channel.awaitMessages(filter, {max: 1, time:10000, errors:["time"]})
            .then(a => {
                try {
                    r.db("loggingbot2").table("guilds").insert({
                        gid: msg.guild.id,
                        channel: a.first().mentions.channels.first().id
                    }).run(conn)
                    console.log(r.db("loggingbot2").table("guilds").filter(a => a.gid == msg.guild.id).run(conn))
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
    } catch(e) {
        let embed = new Discord.RichEmbed().setColor(0xFF0000)
        .setTitle("An error has occurred")
        .setDescription("Unfortunately, an internal error occurred while processing your command.\nYou may report it here along with the full Error Details.")
        .setURL("http://github.com/ry00000/LoggingBot/issues")
        .addField("Error Details", `\`\`\`\n${e}\`\`\``)
        .setFooter(msg.author.tag + " | " + new Date().toUTCString(), msg.author.displayAvatarURL)
    }
})

console.log("RethinkDB connecting")
r.connect({
    host: config.rethinkdb.host,
    port: config.rethinkdb.port,
    db: config.rethinkdb.db,
    user: config.rethinkdb.user,
    password: config.rethinkdb.password
}).then(c => {
    console.log("RethinkDB connected")
    const conn = c
}).catch(e => {
    console.log("RethinkDB connection failed!\n" + e)
    p.exit(1)
})

bot.login(config.token)