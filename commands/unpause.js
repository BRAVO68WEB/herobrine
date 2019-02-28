var config = require("../config.json");
module.exports = {
	help: ()=> "Unpauses execution. Only the bot owner can do this",
	usage: ()=> [" - unpauses execution until the restart command is given"],
	execute: (bot, msg, args)=>{
		if(!config.accepted_ids.includes(msg.author.id)){
			msg.channel.createMessage("Only the bot owner can use this command.");
			return;
		}

		bot.paused = false;
	}
}