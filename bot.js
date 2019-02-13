/*

Steve Bot Version 2.0 Official [Herobrine] (REMOTE)
Begin work date: 07 September 2017
Official "birthday": 25 September 2017

---------------------------------------------------------------------------------------------
*/

const Eris = 		require("eris-additions")(require("eris")); //da lib
const fs =			require("fs"); //file stuff
const {Client} =	require("pg"); //postgres, for data things
const dblite =		require('dblite').withSQLite('3.8.6+'); //dblite, also for data things
const pimg =		require('pngjs-image'); //for image manipulation
const jimp =		require('jimp'); //also for image manipulation
const helptext =	require("./help.js"); //help text
const config =		require('./config.json'); //configs
const Texts =		require('./strings.json'); //json full of text for different things
const Util =		require("./utilities.js");

var cur_logs =		"";

const bot = new Eris(config.token,{restMode: true});

bot.server_configs = {};

//uncommenting the line below may cause "kill einvalid" errors on some computers;
//make sure the config is set up if you're getting issues
// dblite.bin = config.sqlite;

try{
	bot.db = dblite("./data.sqlite","-header");
} catch(e){
	console.log(
		["Error opening database with dblite.",
		"You may need to set sqlite's location in config",
		"and uncomment the dblite.bin line in bot.js (line 32).",
		"This can be fixed by adding sqlite3.exe to your path,",
		"iff applicable."
		].join("\n") + "\nError:\n"+e);
	process.exit(1);
}


/***********************************
SETUP
***********************************/

const setup = async function(){

	bot.db.query(".databases");
	bot.db.query(`CREATE TABLE IF NOT EXISTS triggers (user_id TEXT, code TEXT, list TEXT, alias TEXT)`,(err,rows)=>{
		if(err){
			console.log("There was an error creating the triggers table.")
		}
	});
	bot.db.query(`CREATE TABLE IF NOT EXISTS roles (srv_id TEXT, id TEXT, sar TEXT, bundle TEXT)`,(err,rows)=>{
		if(err){
			console.log("There was an error creating the roles table.")
		}
	});

	bot.db.query(`CREATE TABLE IF NOT EXISTS configs (srv_id TEXT, prefix TEXT, welcome TEXT, autoroles TEXT, disabled TEXT, opped TEXT, feedback TEXT)`,(err,rows)=>{
		if(err){
			console.log(err)
		}
	});

	bot.db.query(`SELECT * FROM configs`,async (err,rows)=>{
		if(err) return console.log(err);

		await Promise.all(rows.map( s =>{
			bot.server_configs[s.srv_id] = s;
			return new Promise((res,rej)=>{
				setTimeout(res("config loaded"),100)
			})
		}))
	});

	bot.db.query(`CREATE TABLE IF NOT EXISTS profiles (usr_id TEXT, info TEXT, badges TEXT, lvl TEXT, exp TEXT, cash TEXT, daily TEXT, disabled TEXT)`,(err,rows)=>{
		if(err) {
			console.log("There was an error creating the profiles table");
		}
	});

	bot.commands.test = await require("./commands/test.js");
	bot.commands.trigs = await require("./commands/trigs.js");
	bot.commands.admin = await require("./commands/admin.js");
	bot.commands.role = await require("./commands/role.js");
}

const cmdHandle = async function(bot, msg, args){
	var clist = bot.commands;
	var cmdname, command, lastindex;
	var parents = [];
	if(!clist[args[0].toLowerCase()] && !Object.values(clist).find(cm => cm.alias && cm.alias.includes(args[0].toLowerCase())))
		return msg.channel.createMessage("Command not found.");
	await Promise.all(args.map((c,cv)=>{
		if(clist!= "" && clist[c.toLowerCase()] || Object.values(clist).find(cm => cm.alias && cm.alias.includes(c.toLowerCase()))){
			var cname = (clist[c.toLowerCase()] ? 
				c.toLowerCase() : 
				Object.keys(clist).find(cm => clist[cm].alias && clist[cm].alias.includes(c.toLowerCase())));
			if(args.length-1 == cv){
				command = clist[cname];
				cmdname = cname;
				args = [];

			} else if(clist[cname].subcommands){
				parents.push({name:cname, cmd:clist[cname]});
				clist = clist[cname].subcommands;
				lastindex = cv;

			} else if(args.length-1 != cv) {
				command = clist[cname];
				cmdname = cname;
				lastindex = cv;
				clist = "";

			}
		} else {
			if(command==undefined)
			command = "notfound";
		}
		return new Promise((res,rej)=>{
			setTimeout(res("beep"),100);
		})
	}))
	if(lastindex != undefined) args = args.slice(-(args.length-(lastindex+1)));
	if((command=="notfound" || command==undefined) && !parents[0]){
		msg.channel.createMessage("Command not found.");
	} else if(parents[0] && (command == "notfound" || command == undefined)){
		if(command.guilOnly && !msg.guild) return msg.channel.createMessage("This command can only be used in guilds.");
		if(parents[parents.length-1].permissions!=undefined){ //check perms
			await Promise.all(parents[parents.length-1].permissions.map(p=>{
				if(msg.member.permission.has(p)){
					return new Promise((res,rej)=>{
						setTimeout(res("passed"),100)
					})
				} else {
					return new Promise((res,rej)=>{
						setTimeout(rej("failed"),100)
					})
				}
			})).then(()=>{
				parents[parents.length-1].cmd.execute(bot,msg,args);
			}).catch(()=>{
				msg.channel.createMessage("You do not have permission to use that command.");
			})
		} else {
			parents[parents.length-1].cmd.execute(bot,msg,args);
		}
		
	} else {
		if(command.guilOnly && !msg.guild) return msg.channel.createMessage("This command can only be used in guilds.");
		if(command.permissions){ //check perms
			await Promise.all(command.permissions.map(p=>{
				if(msg.member.permission.has(p)){
					return new Promise((res,rej)=>{
						setTimeout(res("passed"),100)
					})
				} else {
					return new Promise((res,rej)=>{
						setTimeout(rej("failed"),100)
					})
				}
			})).then(()=>{
				command.execute(bot,msg,args);
			}).catch(()=>{
				msg.channel.createMessage("You do not have permission to use that command.");
			})
		} else {
			command.execute(bot,msg,args);
		}
		
	}

}

/***********************************
COMMANDS
***********************************/

bot.commands = {};

bot.commands.help = {
	help: () => "Use this to list commands or get help with a specific command",
	usage: () => [" - List commands and basic help functions."," [command] - Get help with that command"],
	execute: async (bot, msg, args)=>{
		var clist = bot.commands;
		var cmdname;
		var command;
		var parents = [];
		var embed;
		var prefix = (msg.guild!=undefined && bot.server_configs[msg.guild.id] && (bot.server_configs[msg.guild.id].prefix!= undefined && bot.server_configs[msg.guild.id].prefix!="") ? bot.server_configs[msg.guild.id].prefix : config.prefix[0]);
		await Promise.all(args.map((c,cv)=>{
			if(clist[c.toLowerCase()] || Object.values(clist).find(cm => cm.alias && cm.alias.includes(c.toLowerCase()))){
				var cname = (clist[c.toLowerCase()] ? c.toLowerCase() : Object.keys(clist).find(cm => clist[cm].alias && clist[cm].alias.includes(c.toLowerCase())));
				if(args.length-1 == cv){

					command = clist[cname];
					cmdname = cname;

				} else if(clist[cname].subcommands){

					parents.push({name:cname, cmd:clist[cname]});
					clist = clist[cname].subcommands;

				} else if(args.length-1 != cv) {

					command = clist[cname];
					cmdname = cname;

				}
			} else {
				if(!command)
				command = "notfound";
			}
			return new Promise((res,rej)=>{
				setTimeout(res("beep"),100);
			})
		}))
		if((command=="notfound" || command==undefined) && !parents[0]){
			embed = {
				title: "Herobrine - Help",
				description: "I'm Herobrine! This bot is multi-purpose and intended for a wide range of functions.",
				fields:[
					{name:"**FUN**",
					value: Object.keys(bot.commands).filter(x => bot.commands[x].module == "fun" && !bot.commands[x].alias).map( c => "**"+prefix + c + "** - " + bot.commands[c].help()).sort().join("\n")},
					{name:"**UTILITY**",
					value: Object.keys(bot.commands).filter(x => bot.commands[x].module == "utility" && !bot.commands[x].alias).map( c => "**"+prefix + c + "** - " + bot.commands[c].help()).sort().join("\n")},
					{name:"**ADMIN**",
					value: Object.keys(bot.commands).filter(x => bot.commands[x].module == "admin").map( c => "**"+prefix + c + "** - " + bot.commands[c].help()).join("\n")},
				],
				color: 16755455,
				footer:{
					icon_url: bot.user.avatarURL,
					text: "Arguments like [this] are required, arguments like <this> are optional."
				}
			}
		} else if(parents[0] && (command == "notfound" || command == undefined)){
			command = parents[parents.length-1].cmd;
			embed = {
				title: "Herobrine - Help: "+ parents.map(p => p.name).join(" - "),
				description: command.help() + 
					"\n\n**Usage**\n" +
					command.usage().map(l => prefix + parents.map(p => p.name).join(" ") + l).join("\n") +
					(command.desc!=undefined ? "\n\n"+command.desc() : "") +
					(command.subcommands ? "\n\n**Subcommands**: "+Object.keys(command.subcommands).join(", ") : "") +
					(command.alias!=undefined ? "\n\n**Aliases:** "+command.alias.join(", ") : "") +
					(command.module!=undefined ? "\n\nThis command is part of the **" + (command.module || parents[0].module) + "** module." : "") +
					(command.guildOnly ? "\n\nThis command can only be used in guilds." : ""),
				color: 16755455,
				footer:{
					icon_url: bot.user.avatarURL,
					text: "Arguments like [this] are required, arguments like <this> are optional."
				}
			}
		} else if(parents[0] && command != "notfound"){
			embed = {
				title: "Herobrine - Help: "+ parents.map(p => p.name).join(" - ") + " - " + cmdname,
				description: command.help() + 
					"\n\n**Usage**\n" +
					command.usage().map(l => prefix + parents.map(p => p.name).join(" ") + " " + cmdname + l).join("\n") +
					(command.desc!=undefined ? "\n\n"+command.desc() : "") +
					(command.subcommands ? "\n\n**Subcommands**: "+Object.keys(command.subcommands).join(", ") : "") +
					(command.alias!=undefined ? "\n\n**Aliases:** "+command.alias.join(", ") : "") +
					(command.module!=undefined ? "\n\nThis command is part of the **" + (command.module || parents[0].module) + "** module." : "") +
					(command.guildOnly ? "\n\nThis command can only be used in guilds." : ""),
				color: 16755455,
				footer:{
					icon_url: bot.user.avatarURL,
					text: "Arguments like [this] are required, arguments like <this> are optional."
				}
			}
		} else {
			embed = {
				title: "Herobrine - Help: "+ cmdname,
				description: command.help() + 
					"\n\n**Usage**\n" +
					command.usage().map(l => prefix + cmdname + l).join("\n") +
					(command.desc!=undefined ? "\n\n"+command.desc() : "") +
					(command.subcommands ? "\n\n**Subcommands**: "+Object.keys(command.subcommands).join(", ") : "") +
					(command.alias!=undefined ? "\n\n**Aliases:** "+command.alias.join(", ") : "") +
					(command.module!=undefined ? "\n\nThis command is part of the **" + (command.module) + "** module." : "") +
					(command.guildOnly ? "\n\nThis command can only be used in guilds." : ""),
				color: 16755455,
				footer:{
					icon_url: bot.user.avatarURL,
					text: "Arguments like [this] are required, arguments like <this> are optional."
				}
			}
		}

		if(embed){
			msg.channel.createMessage({embed});
		}
	},
	module: "utility",
	alias: ["h"]
}

//- - - - - - - - - - Roles - - - - - - - - - -
bot.commands.roles = {
	help: ()=> "List all available self roles for a guild.",
	usage: ()=> [" - Lists available roles."],
	execute: (bot, msg, args)=>{
		bot.db.query(`SELECT * FROM roles WHERE srv_id='${msg.guild.id}'`,(err,rows)=>{
			if(rows.length>0){
				msg.channel.createMessage({
					embed: {
						fields:[{
							name:"\\~\\~\\* Available Roles \\*\\~\\~",
							value:rows.map(r => {if(msg.guild.roles.find(rl => rl.id == r.id) && r.sar == "1") return msg.guild.roles.find(rl => rl.id == r.id).name.toLowerCase();})
							.filter(x => x!=null)
							.sort()
							.join("\n")
						}]
					}
				});
			} else {
				msg.channel.createMessage("There are no indexed roles for this server.");
			}
			bot.db.query("BEGIN TRANSACTION");
			rows.forEach(r =>{
				if(!msg.guild.roles.find(rl => rl.id == r.id)){
					bot.db.query(`DELETE FROM roles WHERE id='${r.id}'`);
				}
			})
			bot.db.query("COMMIT");
		});
	},
	module: "utility",
	guildOnly: true
}


//- - - - - - - - - - Pings - - - - - - - - - -

bot.commands.ping = {
	help: ()=> "Ping the Boy:tm:",
	usage: ()=> [" - Returns a random pingy-pongy response."],
	execute: (bot, msg, args)=>{
		var pongs = ["pong!","peng!","pung!","pang!"];
		msg.channel.createMessage(pongs[Math.floor(Math.random()*pongs.length)]);
	},
	module: "fun",
	subcommands: {},
	alias: ["ping!"]
}

bot.commands.ping.subcommands.test = {
	help: ()=> "Test the Boy:tm:",
	usage: ()=> [" - yeet"],
	execute: (bot, msg, args)=>{
		var yeets = ["yeet!","yate!","yote!","yute!", "yite!"];
		msg.channel.createMessage(yeets[Math.floor(Math.random()*yeets.length)]);
	},
	module: "fun"
}

//- - - - - - - - - - Random - - - - - - - - - - - -

bot.commands.random = {
	help: ()=>"Gives a random number.",
	usage: ()=> [" <number> - Gives a number between 1 and 10, or the number provided."],
	execute: (bot, msg, args)=>{
		var max=(isNaN(args[0]) ? 10 : args[0]);
		var num=Math.floor(Math.random() * max);
		var nums=num.toString().split("");

		msg.channel.createMessage("Your number:\n"+nums.map(n => ":"+Texts.numbers[eval(n)] + ":").join(""));
	},
	module: "utility"
}

//- - - - - - - - - - Flip - - - - - - - - - -
bot.commands.flip = {
	help: ()=> "Flips a coin.",
	usage: ()=> [' - flips a virtual coin'],
	execute: (bot, msg, args)=>{
		msg.channel.createMessage("You flipped:\n"+(Math.floor(Math.random()*2) == 1 ? ":o:\nHeads!" : ":x:\nTails!"));
	},
	module: "utility"
}

//- - - - - - - - - - Press F - - - - - - - - - -
bot.commands.pressf = {
	help: ()=> "Presses F.",
	usage: ()=> [" - sends a random F emoji"],
	execute: (bot, msg, args)=>{
		msg.channel.createMessage(Texts.pressf[Math.floor(Math.random()*Texts.pressf.length)]);
	},
	alias:["f"]
}

//- - - - - - - - - - Lovebomb - - - - - - - - - -

bot.commands.lovebomb = {
	help: () => "Get a little bit of love from Herobrine!",
	usage: () => [" - sends about 5 messages in a row that are meant to be affirming"],
	execute: (bot, msg, args) =>{
		var lb = -1000;
		Texts.lovebombs.forEach(async t=>{
			lb+=1000;
			setTimeout(()=>{
				msg.channel.sendTyping();
			},lb)
			setTimeout(()=>{
				msg.channel.createMessage(t.replace("msg.author.username",msg.author.username));
			},lb+500)
		});
	},
	module: "fun"
}

//- - - - - - - - - - Color - - - - - - - -  - - - -

bot.commands.color = {
	help: ()=> "Display a color.",
	usage: ()=> [" [hex code] - sends an image of that color"],
	execute: async (bot, msg, args)=>{
		var c = Util.hex2rgb(args[0]);
		var img;
		new jimp(256,256,args[0],(err,image)=>{
			if(err){
				console.log(err);
				msg.channel.createMessage("Something went wrong.");
			} else {
				var font = (c.r * 0.299) + (c.g * 0.587) + (c.b * 0.114) < 186 ? jimp.FONT_SANS_32_WHITE : jimp.FONT_SANS_32_BLACK;
				jimp.loadFont(font).then(fnt=>{
					image.print(fnt,0,0,{
						text:(args[0].startsWith("#") ? args[0].toUpperCase() : "#" + args[0].toUpperCase()),
						alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,
						alignmentY: jimp.VERTICAL_ALIGN_MIDDLE
					}, 256, 256, (err,img,{x,y})=>{
						img.getBuffer(jimp.MIME_PNG,(err,data)=>{
							msg.channel.createMessage({content: "Your color:"},{file:data,name:"color.png"})
						})
					})

				})

			}
		})
	},
	subcommands: {}
}

bot.commands.color.subcommands.change = {
	help: ()=> "Changes your current color",
	usage: ()=>[" [hex color/name/etc] - changes current color to provided color"],
	execute: (bot, msg, args)=>{
		var c = args.join(" ");
		if(c.startsWith("#")) c = c.replace("#","");
		if(Texts.colors[c.toLowerCase()]) c = Texts.colors[c.toLowerCase()];
		if(msg.guild.roles.find(r=>r.name == msg.author.id)){
			var role = msg.guild.roles.find(r=>r.name == msg.author.id);
			role.edit({color:parseInt(c,16)}).then(()=>{
				if(!msg.member.roles.includes(msg.author.id)){
					msg.member.addRole(role.id)
				}
				msg.channel.createMessage("Changed "+msg.author.username+"'s color to #"+c);
			})
		} else {
			msg.guild.createRole({name: msg.author.id,color:parseInt(c,16)}).then((role)=>{
				msg.member.addRole(role.id);
				msg.channel.createMessage("Changed "+msg.author.username+"'s color to #"+c);
			}).catch(e=>{
				console.log(e);
				msg.channel.createMessage("Something went wrong.")
			})
		}
		
	},
	guildOnly: true
}

//- - - - - - - - - - Eval - - - - - - - - - -
bot.commands.eval = {
	help: ()=>"Evaluate javascript code.",
	usage: ()=>[" [code] - Evaluates given code."," prm [code] - Evaluates given code, and any returned promises."],
	desc: ()=>"Only the bot owner can use this command.",
	execute: (bot, msg, args)=>{
		if(!config.accepted_ids.includes(msg.author.id)){ return msg.channel.createMessage("Only the bot owner can use this command."); }
		if(args[0] == "prm"){
			async function f(){

				try {
					const promeval = args.slice(1).join(" ");
					let evlp = await eval(promeval);

					if(typeof(evlp)!=="string"){
						evlp=require("util").inspect(evlp);
					}

					msg.channel.createMessage(Util.cleanText(evlp));
				} catch (err) {
					if(err){console.log(err)}
				}

			}

			f();

		} else {
			try {
				const toeval = args.join(" ");
				let evld = eval(toeval);

				if(typeof(evld)!=="string"){
					evld=require("util").inspect(evld);
				}

				msg.channel.createMessage(Util.cleanText(evld));
			} catch (err) {
				if(err){console.log(err)}
			};
		}

	},
	module: "admin"
}

//---------------------------------------------- FUN ---------------------------------------------------
//======================================================================================================
//------------------------------------------------------------------------------------------------------

//- - - - - - - - - - What's up - - - - - - - - - -
bot.commands.whats={
	help: ()=> "Return a random phrase about what's up.",
	usage: ()=>[" - Return random tidbit."],
	execute: (bot, msg, args)=>{
		if(!args[0]){ return }
		if(args[0].match(/up\?*/)){
			msg.channel.createMessage(Util.randomText(Texts.wass));
		}
	},
	module: "fun",
	alias: ["what's"]
}

// - - - - - - - - - - Profiles - - - - - - - - - -
bot.commands.profile = {
	help: ()=> "Shows your profile.",
	usage: ()=> [" - views your profile",
				" [discord ID] - views another user's profile",
				"edit - opens a menu for profile editing",
				"enable/disable - enables/disables level-up messages"],
	execute: (bot, msg, args)=>{
		var id = (args[0] ? args[0] : msg.author.id);
		bot.db.query(`SELECT * FROM profiles WHERE usr_id='${id}'`,(err,rows)=>{
			if(err){
				console.log(err);
				return msg.channel.createMessage("User profile not found or not indexed yet.");
			}
			msg.channel.createMessage({embed:{
				author: {
					name: msg.guild.members.find(m => m.id == id).username,
					icon_url: msg.guild.members.find(m => m.id == id).avatarURL
				},
				thumbnail: {
					url: msg.guild.members.find(m => m.id == id).avatarURL
				},
				color: (JSON.parse(rows[0].info).color ? JSON.parse(rows[0].info).color : 0),
				title: JSON.parse(rows[0].info).title,
				description: JSON.parse(rows[0].info).bio +
				"\n**LEVEL:** "+rows[0].lvl +
				"\n**EXP:** "+rows[0].exp +
				"\n**CASH:** "+rows[0].cash +
				(rows[0].disabled == "1" ? "\n\n*Level up messages are disabled for this user.*" : "")
			}})
		})
	},
	alias: ["p","prof"],
	subcommands: {},
	guildOnly: true
}

bot.commands.profile.subcommands.disable = {
	help: ()=> "Disables level up messages.",
	usage: ()=> [" - disables level up messages"],
	execute: (bot, msg, args)=>{
		bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
			if(err) return console.log(err);
			if(rows[0]){
				if(rows[0].disabled == "1"){
					msg.channel.createMessage("Already disabled.");
				} else {
					bot.db.query(`UPDATE profiles SET disabled='${"1"}' WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
						if(err){
							console.log(err);
							return msg.channel.createMessage("Something went wrong.");
						}
						msg.channel.createMessage("Level-up messages disabled.")
					})
				}
			} else {
				msg.channel.createMessage("Something went wrong.");
			}
		})
	}
}

bot.commands.profile.subcommands.enable = {
	help: ()=> "Enables level up messages.",
	usage: ()=> [" - enables level up messages"],
	execute: (bot, msg, args)=>{
		bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
			if(err) return console.log(err);
			if(rows[0]){
				if(rows[0].disabled == "0"){
					msg.channel.createMessage("Already enabled.");
				} else {
					bot.db.query(`UPDATE profiles SET disabled='${"0"}' WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
						if(err){
							console.log(err);
							return msg.channel.createMessage("Something went wrong.");
						}
						msg.channel.createMessage("Level-up messages enabled.")
					})
				}
			} else {
				msg.channel.createMessage("Something went wrong.");
			}
		})
	}
}

bot.commands.profile.subcommands.edit = {
	help: ()=> "Runs a menu for editing profiles.",
	usage: ()=> [" - opens an edit menu",
				" [bio/title/color] [new value] - quick edit method for your bio/title/color"],
	execute: async (bot, msg, args)=>{
		switch(args[0]){
			case "bio":
				var b = (args[1] ? args.slice(1).join(" ") : "Beep Boop!");
				bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
					if(err){
						console.log(err);
						return msg.channel.createMessage("There was an error.")
					}
					if(rows[0]){
						var info = JSON.parse(rows[0].info);
						info.bio = b;
						bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
							if(err){
								console.log(err)
								return msg.channel.createMessage("There was an error.");
							}
							msg.channel.createMessage((t == "Beep Boop!" ? "Bio reset." : "Bio updated."));
						})
					} else {
						msg.channel.createMessage("Something went wrong.");
					}
				})
				break;
			case "title":
				var t = (args[1] ? args.slice(1).join(" ") : "Title Here");
					bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
						if(err){
							console.log(err);
							return msg.channel.createMessage("There was an error.")
						}
						if(rows[0]){
							var info = JSON.parse(rows[0].info);
							info.title = t;
							bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
								if(err){
									console.log(err)
									return msg.channel.createMessage("There was an error.");
								}
								msg.channel.createMessage((t == "Title Here" ? "Title reset." : "Title updated."));
							})
						} else {
							msg.channel.createMessage("Something went wrong.");
						}
					})
				break;
			case "color":
				var c = (args[1] ? parseInt(args[1].replace("#",""),16) : 0);
					bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
						if(err){
							console.log(err);
							return msg.channel.createMessage("There was an error.")
						}
						if(rows[0]){
							var info = JSON.parse(rows[0].info);
							info.color = c;
							bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
								if(err){
									console.log(err)
									return msg.channel.createMessage("There was an error.");
								}
								msg.channel.createMessage((c == 0 ? "Color reset." : "Color updated."));
							})
						} else {
							msg.channel.createMessage("Something went wrong.");
						}
					})
				break;
			default:
				var info;
				await bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
					if(err){
						console.log(err);
						return msg.channel.createMessage("There was an error.");
					}
					if(rows[0]){
						info = JSON.parse(rows[0].info);
					} else {
						msg.channel.createMessage("Something went wrong.")
					}
				})
				msg.channel.createMessage("```\nWhat do you want to edit? (Choose a number)\n\n[1] Title\n[2] Bio\n[3] Color\n[4] Cancel\n```");
				msg.channel.awaitMessages(m => m.author.id == msg.author.id, {time: 10000, maxMatches: 1}).then(res=>{
					if(res[0]){
						switch(res[0].content){
							case "1":
								msg.channel.createMessage("Write what you want the new title to be.");
								msg.channel.awaitMessages(m => m.author.id == msg.author.id,{time: 20000, maxMatches: 1}).then(res2=>{
									if(res2[0]){
										info.title = res2[0].content;
										bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
											if(err){
												console.log(err);
												msg.channel.createMessage("There was an error.")
											} else {
												msg.channel.createMessage("Title updated.")
											}
										})
									} else {
										msg.channel.createMessage("Action cancelled.")
									}
								})
								break;
							case "2":
								msg.channel.createMessage("Write what you want the new bio to be.");
								msg.channel.awaitMessages(m => m.author.id == msg.author.id,{time: 20000, maxMatches: 1}).then(res2=>{
									if(res2[0]){
										info.bio = res2[0].content;
										bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
											if(err){
												console.log(err);
												msg.channel.createMessage("There was an error.")
											} else {
												msg.channel.createMessage("Bio updated.")
											}
										})
									} else {
										msg.channel.createMessage("Action cancelled.")
									}
								})
								break;
							case "3":
								msg.channel.createMessage("Write what you want the new color to be.");
								msg.channel.awaitMessages(m => m.author.id == msg.author.id,{time: 20000, maxMatches: 1}).then(res2=>{
									if(res2[0]){
										info.color = parseInt(res2[0].content.replace("#",""),16);
										bot.db.query(`UPDATE profiles SET info=? WHERE usr_id='${msg.author.id}'`,[info],(err,rows)=>{
											if(err){
												console.log(err);
												msg.channel.createMessage("There was an error.")
											} else {
												msg.channel.createMessage("Color updated.")
											}
										})
									} else {
										msg.channel.createMessage("Action cancelled.")
									}
								})
								break;
							default:
								msg.channel.createMessage("Action cancelled.")
								break;
						}
					} else {
						msg.channel.createMessage("Action cancelled.")
					}
				})
				break;
		}
	}
}

//************************************** BOT EVENTS **************************************************
//----------------------------------------------------------------------------------------------------
//****************************************************************************************************


bot.on("ready",()=>{
	console.log("Ready.");
	let now = new Date();
	let ndt = `${(now.getMonth() + 1).toString().length < 2 ? "0"+ (now.getMonth() + 1) : now.getMonth()+1}.${now.getDate().toString().length < 2 ? "0"+ now.getDate() : now.getDate()}.${now.getFullYear()}`;
	if(!fs.existsSync(`./logs/${ndt}.log`)){
		fs.writeFile(`./logs/${ndt}.log`,"===== LOG START =====\r\n=== BOT READY ===",(err)=>{
			if(err) console.log(`Error while attempting to write log ${ndt}\n`+err);
		});
		cur_logs = ndt;
	} else {
		fs.appendFile(`./logs/${ndt}.log`,"\n=== BOT READY ===",(err)=>{
			if(err) console.log(`Error while attempting to apend to log ${ndt}\n`+err);
		});
		cur_logs = ndt;
	}
})

//- - - - - - - - - - MessageCreate - - - - - - - - - -
bot.on("messageCreate",async (msg)=>{
	if(msg.author.bot) return;

	if(msg.content.toLowerCase()=="hey herobrine"){
		msg.channel.createMessage("That's me!");
		return;
	}

	//if(new RegExp("good\s").test(msg.content.toLowerCase()))

	bot.db.query(`SELECT * FROM profiles WHERE usr_id='${msg.author.id}'`,(err,rows)=>{
		if(err){
			console.log(err)
		} else {
			if(rows[0]){
				var exp = eval(rows[0].exp);
				var lve = eval(rows[0].lvl);
				if(exp+5>=(Math.pow(lve,2)+100)){
					lve=lve+1;
					if(exp-(Math.pow(lve,2)+100)>=0){
						exp=exp-(Math.pow(lve,2)+100);
					} else {
						exp=0;
					}

					if(rows[0].disabled != "1") msg.channel.createMessage(`Congratulations, ${(msg.member.nickname==null ? msg.author.username : msg.member.nickname)}! You are now level ${lve}!`);
				} else {
					exp=exp+5;
				}
				bot.db.query(`UPDATE profiles SET exp='${exp}', lvl='${lve}', cash='${eval(rows[0].cash)+5}' WHERE usr_id='${msg.author.id}'`);
			} else {
				bot.db.query(`INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?)`,[msg.author.id,{title:"Title Here",bio:"Beep boop!"},{},"1","5","5","0","0"],(err,rows)=>{
					if(err){
						console.log("Error creating profile: \n"+err);
					} else {
						console.log("profile created");
					}
				})
			}
		}
	})

	if(new RegExp("^"+config.prefix.join("|")).test(msg.content.toLowerCase()) || (msg.guild!=undefined && bot.server_configs[msg.guild.id] && (bot.server_configs[msg.guild.id].prefix!= undefined && bot.server_configs[msg.guild.id].prefix!="") && msg.content.toLowerCase().startsWith(bot.server_configs[msg.guild.id].prefix))){
		let now = new Date();
		let ndt = `${(now.getMonth() + 1).toString().length < 2 ? "0"+ (now.getMonth() + 1) : now.getMonth()+1}.${now.getDate().toString().length < 2 ? "0"+ now.getDate() : now.getDate()}.${now.getFullYear()}`;
		if(!fs.existsSync(`./logs/${ndt}.log`)){
			fs.writeFile(`./logs/${ndt}.log`,"===== LOG START =====",(err)=>{
				console.log(`Error while attempting to write log ${ndt}\n`+err);
			});
			cur_logs = ndt;
		} else {
			cur_logs = ndt;
		}
		var str = `\r\nTime: ${ndt} at ${now.getHours().toString().length < 2 ? "0"+ now.getHours() : now.getHours()}${now.getMinutes()}\nMessage: ${msg.content}\nUser: ${msg.author.username}#${msg.author.discriminator}\nGuild: ${(msg.guild!=undefined ? msg.guild.name + "(" +msg.guild.id+ ")" : "DMs")}\r\n--------------------`;
		console.log(str);
		fs.appendFile(`./logs/${ndt}.log`,str,(err)=>{
			if(err) console.log(`Error while attempting to write log ${ndt}\n`+err);
		});

		let args = msg.content.replace(new RegExp("^"+config.prefix.join("|")+((msg.guild != undefined && bot.server_configs[msg.guild.id] && (bot.server_configs[msg.guild.id].prefix!=undefined && bot.server_configs[msg.guild.id].prefix!="")) ? "|"+bot.server_configs[msg.guild.id].prefix : ""),"i"), "").split(" ");
		cmdHandle(bot, msg, args);

	}


})

bot.on("guildMemberAdd",async (guild, member)=>{
	if(bot.server_configs[guild.id]){
		var scfg = bot.server_configs[guild.id];
		if(scfg.welcome.enabled){
			bot.createMessage(scfg.welcome.channel,scfg.welcome.message);
		}
		if(scfg.autoroles != ""){
			await Promise.all(scfg.autoroles.split(",").map(r=>{
				member.addRole(r);
			})).then(()=>{
				console.log(`Successfully added autoroles in guild ${guild.name} ${guild.id}`);
			}).catch(e=> console.log(e));
		}
	}
})


//----------------------------------------------------------------------------------------------------//

setup();
bot.connect()
.catch(e => console.log("Trouble connecting...\n"+e))
