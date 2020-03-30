const Discord = require('discord.js');
const BaseCommand = require('../lib/command');
const request = require('../lib/requests');
var chrono = require('chrono-node');
var moment = require('moment-timezone');
var ics = require('ics');

class Command extends BaseCommand {

    REACTION_YES = {
        emoji: '✅',
        name: 'Deltager',
        crew: 0,
    };
    REACTION_NO = {
        emoji: '❌',
        name: 'Deltager ikke',
        crew: 0,
    };
    REACTION_MAYBE = {
        emoji: '❔',
        name: 'Deltager måske',
        crew: 0,
    };
    REACTION_NOTIFY = {
        emoji: '⏰',
        name: 'Notifikation',
        crew: 0,
    };

    constructor() {
        super();
        this.name = 'event';
        this.description = 'Opret en begivenhed med simpel tilbagemelding eller med roller, hvis du ikke angiver parametre så spørger jeg dig om dem.';
        this.usage = 'event [title] [time]\n'+
                     '> Opret en simpel event med en titel og tidspunkt. Angiv :time som dato med tid, eller på engelsk som "friday 20:00".\n'+
                     '> Eksempel: event "Inside Star Citizen" Thursday 21:00\n'+
                     'event roles [roles] [title] [time]\n'+
                     '> Opret event med definerede roller. Flere roller kan defineres ved at adskille med komma, antal efter ":", {rolle1:2,rolle2:4}.\n'+
                     '> Eksempel: event roles Traders:2,Gunners:4,Fighters:3 "Cargo run to Arial" Wednesday 20:00';
        
        this.conversations = {
            default: {
                title: {
                    question: 'Hvad er titlen på begivenheden?',
                    answer: 'Titel',
                    next: 'time'
                },
                time: {
                    question: 'Hvad tidspunkt er begivenheden?',
                    answer: 'Tid',
                    next: 'confirm',
                },
                confirm: {
                    question: 'Er du sikker på jeg skal oprette begivenheden (yes/no)?',
                    help: 'Hvis du ønsker at ændre noget skal du bare starte forfra, ved at sende en "event" kommando til mig.',
                    showAnswers: true,
                    next: {
                        yes: '#save#',
                        no: '#cancel#',
                    }
                }
            },
            roles: {
                roles: {
                    question: 'Hvad er navnet på rollen og hvor mange skal du bruge?',
                    help: 'Skriv en titel eller navn på rollen, efterfuldt af antallet du skal bruge.',
                    answer: 'Rolle(r)',
                    next: 'more',
                    validation: '^(.+) (\\d+)$',
                    pushToArray: true,
                },
                more: {
                    question: 'Skal du oprette en rolle mere?',
                    next: {
                        yes: 'roles',
                        no: 'title',
                    }
                },
                title: {
                    question: 'Hvad er titlen på begivenheden?',
                    answer: 'Titel',
                    next: 'time'
                },
                time: {
                    question: 'Hvad tidspunkt er begivenheden?',
                    answer: 'Tid',
                    next: 'confirm',
                },
                confirm: {
                    question: 'Er du sikker på jeg skal oprette begivenheden (yes/no)?',
                    help: 'Hvis du ønsker at ændre noget skal du bare starte forfra, ved at sende en "event roles" kommando til mig.',
                    showAnswers: true,
                    next: {
                        yes: '#save#',
                        no: '#cancel#',
                    }
                }
            }
        };
    }

    execute(message, args, dataMessage) {
        if (args.length === 0) {
            // They did not give any instructions on what to do, start default conversation
            args.push('default');
            this.handleConversation(message, args, dataMessage)
        }
        else {
            switch (args[0]) {
                case 'default':
                    try {
                        this.handleConversation(message, args, dataMessage)
                    }
                    catch (e) {
                        if (e.state) {
                            if (e.state === 'save') {
                                this.createEvent(message,
                                    e.data.guild,
                                    e.data.values.title, 
                                    new Date(chrono.parseDate(e.data.values.time, moment().tz('Europe/Copenhagen'), { forwardDate: true }))
                                );
                            }
                        }
                    }
                    break;
                case 'roles':
                    if (args.length === 1) {
                        // They want a roles based event, but did not give the info on command, start conversation
                        try {
                            this.handleConversation(message, args, dataMessage)
                        }
                        catch (e) {
                            if (e.state) {
                                if (e.state === 'save') {
                                    var roles = e.data.values.roles.map(r => {
                                        var r2 = r.match(/^(.+) (\d)$/);
                                        return [r2[1], r2[2]];
                                    });
                                    this.createEvent(message,
                                        e.data.guild,
                                        e.data.values.title, 
                                        moment(chrono.parseDate(e.data.values.time, moment().tz('Europe/Copenhagen'), { forwardDate: true })), 
                                        roles);
                                }
                            }
                        }
                    }
                    else {
                        let subcmd = args.shift();  // first is sub command = roles
                        let roles = args.shift();   // second is the roles definition
                        let title = args.shift();   // third is title of the event
                        let time = args.join(' ');  // any following is the time of event
                        roles = roles.split(/,/).map(v => v.split(/:/));
                        time = moment(chrono.parseDate(time, moment().tz('Europe/Copenhagen'), { forwardDate: true }));
                        this.createEvent(message, message.guild.id, title, time, roles);
                    }
                    break;
                default:
                    let title = args.shift();   // third is title of the event
                    let time = args.join(' ');  // any following is the time of event
                    time = moment(chrono.parseDate(time, moment().tz('Europe/Copenhagen'), { forwardDate: true }));
                    this.createEvent(message, message.guild.id, title, time);
                    break;
            }
        }
    }

    createEvent(message, guildId, title, time, roles = []) {
        const embed = new Discord.MessageEmbed();
        embed.setTitle('🗓 '+title);
        embed.setDescription('Begivneheden starter ' + time.locale('da').format('LLLL'));
        roles.forEach((r,i) => {
            embed.addField(String.fromCharCode(0x0031+i, 0xFE0F, 0x20E3) + ` ${r[0]} (0/${r[1]})`, '-', true);
        });
        embed.addField(this.REACTION_YES.emoji + ' ' + this.REACTION_YES.name, '-', true);
        embed.addField(this.REACTION_MAYBE.emoji + ' ' + this.REACTION_MAYBE.name, '-', true);
        embed.addField(this.REACTION_NO.emoji + ' ' + this.REACTION_NO.name, '-', true);
        embed.addField('Der er endnu ingen tilmeldinger', 'Giv besked ved at trykke på en reaktion under beskeden.');
        BaseCommand.encodeFooter(embed, {
            command: 'event',
            time: time,
            roles: roles,
        });
        this.client.guilds.cache.find(g => g.id === guildId)
            .channels.cache.find(c => c.name === 'events').send(embed)
            .then(async m => {
                roles.forEach(async (r,i) => {
                    await m.react(String.fromCharCode(0x0031+i, 0xFE0F, 0x20E3));
                });
                await m.react(this.REACTION_YES.emoji);
                await m.react(this.REACTION_MAYBE.emoji);
                await m.react(this.REACTION_NO.emoji);
                await m.react(this.REACTION_NOTIFY.emoji);
            })
            .catch(e => console.log(e));
    }

    getIcalFile(title, time, duration) {
        var data = {
            title: title,
            startInputType: 'utc',
            start: time.utc().format('YYYY-M-D-H-m').split("-"),
            duration: { hours: duration ? duration : 1 }
        };
        const eventICal = ics.createEvent(data);
        if (eventICal.error) {
            throw eventICal.error;
        }
        return eventICal.value;
    }

    executeReaction(event, reaction, user, data) {
        var embed = reaction.message.embeds.pop();

        if (event !== 'remove' && reaction.emoji.name === this.REACTION_NOTIFY.emoji) {
            var title = embed.title.substring(3);
            user.send(
                'Her en file for begivenheden "'+title+'" du kan tilføje til din egen kalender', 
                new Discord.MessageAttachment(Buffer.from(this.getIcalFile(title, moment(data.time))), 'event.ics'));
            return;
        }

        var reactionList = [];
        data.roles.forEach((r, i) => {
            reactionList.push({
                emoji: String.fromCharCode(0x0031+i, 0xFE0F, 0x20E3),
                name: r[0],
                crew: r[1],
            });
        });
        reactionList.push(this.REACTION_YES);
        reactionList.push(this.REACTION_MAYBE);
        reactionList.push(this.REACTION_NO);
        reactionList.push(this.REACTION_NOTIFY);
        
        var mr = null;
        var total = 0;
        var count = 0;
        let userFetches = [];
        // We need to fetch the users of all reactions to build the fields
        reaction.message.reactions.cache.each(r => {
            if (r.count !== r.users.cache.size) {
                userFetches.push(r.users.fetch());
            }
        });
        Promise.all(userFetches).then(() => {
            let excludeUsers = null;
            reactionList.forEach((r, i) => {
                // Do not count the notification reaction
                if (r.emoji !== this.REACTION_NOTIFY.emoji) {
                    // Make sure the bot is excluded from attendance lists
                    excludeUsers = [this.client.user.id];
                    mr = reaction.message.reactions.cache.find(re => re.emoji.name === r.emoji);
                    if (mr) {
                        // if this is not a remove event, then check if the user is on another reaction, and the bot should not remove it own reactions
                        if (event !== 'remove' && mr.emoji.name !== reaction.emoji.name && mr.users.cache.has(user.id) && this.client.user.id != user.id) {
                            // exclude the user and remove the user async from the reaction
                            excludeUsers.push(user.id);
                            mr.users.remove(user.id);
                        }
                        // Build a list of users except the 
                        embed.fields[i].value = mr.users.cache.filter(u => !excludeUsers.includes(u.id)).map(u => '> <@' + u.id + '>').join('\n');
                        count = mr.users.cache.size-1;
                    }
                    if (embed.fields[i].value === '') {
                        embed.fields[i].value = '-';
                        count = 0;
                    }
                    embed.fields[i].name = `${r.emoji} ${r.name}` + (r.crew ? ` (${count}/${r.crew})` : ` (${count})`);
                    total += count;
                }
            });
            embed.fields[reactionList.length-1].name = `Der er ${total} bruger(e) som har givet besked`;
            reaction.message.edit(embed)
            .then(async m => {
                reactionList.forEach(async (r,i) => {
                    if (!m.reactions.cache.has(r.emoji)) {
                        await m.react(r.emoji);
                    }
                });
                console.log('done', event, reaction.emoji.name, user.username);
            })
            .catch(e => console.log(e));
        });
    }
};

module.exports = new Command();