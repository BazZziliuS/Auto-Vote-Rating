/**
 * Миграция БД версии 13 - переименование рейтингов
 * Обновляет старые названия рейтингов на доменные имена
 */

/**
 * Возвращает Map со старыми названиями рейтингов
 * @returns {Map<string, string>} Map со старыми названиями и новыми доменами
 */
function getOldRatingNames() {
    return new Map([
        ['TopCraft', 'topcraft.ru'],
        ['McTOP', 'mctop.su'],
        ['MCRate', 'mcrate.su'],
        ['MinecraftRating', 'minecraftrating.ru'],
        ['MonitoringMinecraft', 'monitoringminecraft.ru'],
        ['IonMc', 'ionmc.top'],
        ['MinecraftServersOrg', 'minecraftservers.org'],
        ['ServeurPrive', 'serveur-prive.net'],
        ['PlanetMinecraft', 'planetminecraft.com'],
        ['TopG', 'topg.org'],
        ['ListForge', 'listforge.net'],
        ['MinecraftServerList', 'minecraft-server-list.com'],
        ['ServerPact', 'serverpact.com'],
        ['MinecraftIpList', 'minecraftiplist.com'],
        ['TopMinecraftServers', 'topminecraftservers.org'],
        ['MinecraftServersBiz', 'minecraftservers.biz'],
        ['HotMC', 'hotmc.ru'],
        ['MinecraftServerNet', 'minecraft-server.net'],
        ['TopGames', 'top-games.net'],
        ['TMonitoring', 'tmonitoring.com'],
        ['TopGG', 'top.gg'],
        ['DiscordBotList', 'discordbotlist.com'],
        ['Discords', 'discords.com'],
        ['MMoTopRU', 'mmotop.ru'],
        ['MCServers', 'mc-servers.com'],
        ['MinecraftList', 'minecraftlist.org'],
        ['MinecraftIndex', 'minecraft-index.com'],
        ['ServerList101', 'serverlist101.com'],
        ['MCServerList', 'mcserver-list.eu'],
        ['CraftList', 'craftlist.org'],
        ['CzechCraft', 'czech-craft.eu'],
        ['MinecraftBuzz', 'minecraft.buzz'],
        ['MinecraftServery', 'minecraftservery.eu'],
        ['RPGParadize', 'rpg-paradize.com'],
        ['MinecraftServerListNet', 'minecraft-serverlist.net'],
        ['MinecraftServerEu', 'minecraft-server.eu'],
        ['MinecraftKrant', 'minecraftkrant.nl'],
        ['TrackyServer', 'trackyserver.com'],
        ['MCListsOrg', 'mc-lists.org'],
        ['TopMCServersCom', 'topmcservers.com'],
        ['BestServersCom', 'bestservers.com'],
        ['CraftListNet', 'craft-list.net'],
        ['MinecraftServersListOrg', 'minecraft-servers-list.org'],
        ['ServerListe', 'serverliste.net'],
        ['gTop100', 'gtop100.com'],
        ['WARGM', 'wargm.ru'],
        ['MineStatus', 'minestatus.net'],
        ['MisterLauncher', 'misterlauncher.org'],
        ['MinecraftServersDe', 'minecraft-servers.de'],
        ['DiscordBoats', 'discord.boats'],
        ['ServerListGames', 'serverlist.games'],
        ['BestMinecraftServers', 'best-minecraft-servers.co'],
        ['MinecraftServers100', 'minecraftservers100.com'],
        ['MCServerListCZ', 'mc-serverlist.cz'],
        ['MineServers', 'mineservers.com'],
        ['ATLauncher', 'atlauncher.com'],
        ['ServersMinecraft', 'servers-minecraft.net'],
        ['MinecraftListCZ', 'minecraft-list.cz'],
        ['ListeServeursMinecraft', 'liste-serveurs-minecraft.org'],
        ['MCServidores', 'mcservidores.com'],
        ['XtremeTop100', 'xtremetop100.com'],
        ['MinecraftServerSk', 'minecraft-server.sk'],
        ['ServeursMinecraftOrg', 'serveursminecraft.org'],
        ['ServeursMCNet', 'serveurs-mc.net'],
        ['ServeursMinecraftCom', 'serveur-minecraft.com'],
        ['ServeurMinecraftVoteFr', 'serveur-minecraft-vote.fr'],
        ['MineBrowseCom', 'minebrowse.com'],
        ['MCServerListCom', 'mc-server-list.com'],
        ['ServerLocatorCom', 'serverlocator.com'],
        ['TopMmoGamesRu', 'top-mmogames.ru'],
        ['MmoRpgTop', 'mmorpg.top'],
        ['MmoVoteRu', 'mmovote.ru'],
        ['McMonitoringInfo', 'mc-monitoring.info'],
        ['McServerTimeCom', 'mcservertime.com'],
        ['ListeServeursFr', 'liste-serveurs.fr'],
        ['ServeurMinecraftFr', 'serveur-minecraft.fr'],
        ['MineServTop', 'mineserv.top'],
        ['Top100ArenaCom', 'top100arena.com'],
        ['MinecraftBestServersCom', 'minecraftbestservers.com'],
        ['MCLikeCom', 'mclike.com'],
        ['PixelmonServerListCom', 'pixelmon-server-list.com'],
        ['MinecraftServerSk2', 'minecraftserver.sk'],
        ['ServidoresdeMinecraftEs', 'servidoresdeminecraft.es'],
        ['MinecraftSurvivalServersCom', 'minecraftsurvivalservers.com'],
        ['MinecraftGlobal', 'minecraft.global'],
        ['Warface', 'warface.com'],
        ['CurseForge', 'curseforge.com'],
        ['HoYoLAB', 'hoyolab.com'],
        ['TrackingServers', 'trackingservers.cloud'],
        ['McListIo', 'mclist.io'],
        ['LoliLand', 'loliland.ru'],
        ['MCServersTOP', 'mcservers.top'],
        ['Discadia', 'discadia.com'],
        ['MinecraftSurvivalServers', 'minecraftsurvivalservers.net'],
        ['TopServersCom', 'topservers.com'],
        ['GenshinDrop', 'genshindrop.com'],
        ['EmeraldServers', 'emeraldservers.com'],
        ['ServidoresMC', '40servidoresmc.es'],
        ['MinecraftServersBiz2', 'minecraft-servers.biz'],
        ['TopMCServersNet', 'top-mc-servers.net'],
        ['MinecraftServerListCom', 'minecraft-serverlist.com'],
        ['FindMCServer', 'findmcserver.com'],
        ['ServeurListe', 'serveurliste.com'],
        ['CraftBook', 'craftbook.cz'],
        ['RovelStars', 'rovelstars.com'],
        ['InfinityBots', 'infinitybots.gg'],
        ['BotListMe', 'botlist.me'],
        ['TopMinecraftIo', 'topminecraft.io'],
        ['MineListNet', 'minelist.net'],
        ['ListeServMinecraftFr', 'liste-serv-minecraft.fr'],
        ['PlayMinecraftServersCom', 'play-minecraft-servers.com'],
        ['MinecraftMenu', 'minecraft.menu'],
        ['Custom', 'Custom']
    ])
}

/**
 * Миграция v13 - переименование рейтингов и обновление структуры проектов
 * @async
 * @param {IDBTransaction} transaction - Транзакция БД
 * @param {Object} allProjects - Конфигурации всех проектов
 * @param {Function} getDomainWithoutSubdomain - Функция получения домена
 * @returns {Promise<void>}
 */
async function migrateV13(transaction, allProjects, getDomainWithoutSubdomain) {
    const oldNames = getOldRatingNames()
    let cursor = await transaction.objectStore('projects').openCursor()

    while (cursor) {
        const project = cursor.value

        const domain = oldNames.get(project.rating)
        const voteURL = allProjects[domain]?.voteURL?.(project)

        if (!domain || !voteURL) {
            console.warn('When updating the database, it was not possible to find information on rating, additional information:', JSON.stringify(project), 'domain', domain, 'voteURL', voteURL)
            await cursor.delete()
            cursor = await cursor.continue()
            continue
        }

        const domain2 = getDomainWithoutSubdomain(voteURL)
        if (domain2 && domain !== domain2 && domain !== 'Custom') {
            project.rating = domain2
            project.ratingMain = domain
        } else {
            project.rating = domain
        }

        // Специальная обработка для topg.org
        if (project.rating === 'topg.org') {
            // noinspection JSCheckFunctionSignatures
            if (!isNaN(project.id.at(0))) {
                project.id = 'server-' + project.id
            }
        }

        // Переименование поля game в listing для определенных рейтингов
        if (project.rating === 'minecraftrating.ru' ||
            project.rating === 'top.gg' ||
            project.rating === 'discordbotlist.com' ||
            project.rating === 'discords.com' ||
            project.rating === 'misterlauncher.org') {
            project.listing = project.game
            delete project.game
        } else if (project.rating === 'minecraftkrant.nl') {
            if (!project.game) project.game = 'www.minecraftkrant.nl'
            project.lang = project.game
            delete project.game
        } else {
            delete project.game
        }

        // Блокировка закрытых проектов
        if (((project.rating === 'topcraft.club' || project.rating === 'topcraft.ru') && project.id === '7666') ||
            (project.id === 'arago' && (project.rating === 'minecraftrating.ru' || project.rating === 'tmonitoring.com'))) {
            project.error = chrome.i18n.getMessage('disabledSite', 'Проект закрыт')
            project.time = Infinity
        }

        // Блокировка craftlist.org
        if (project.rating === 'craftlist.org') {
            project.error = chrome.i18n.getMessage('disabledSite', 'There is a high risk of being blocked for auto-voting, vote on this site manually')
            project.time = Infinity
        }

        // Добавление ключа если отсутствует
        if (project.key == null) {
            project.key = cursor.key
        }

        // Удаление устаревших полей
        // noinspection JSUnresolvedReference
        delete project.openedTimeoutQueue
        // noinspection JSUnresolvedReference
        delete project.openedNextAttempt
        // noinspection JSUnresolvedReference
        delete project.openedCountInject

        await cursor.update(project)
        cursor = await cursor.continue()
    }
}
