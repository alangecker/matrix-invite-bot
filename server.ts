import {
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
} from "matrix-bot-sdk";
import {
    HOMESERVER_URL,
    ACCESS_TOKEN,
    HTTP_LISTEN_PORT,
    INVITE_RATE_PER_SECOND
} from './config'
import botStorageLayer from './helpers/storageLayer'


import * as express from 'express'
import * as bodyParser from 'body-parser'
import botDialog from './botDialog'
import {
    startInviteQueueWorker,
    getQueueLength
} from './helpers/inviteQueue'
import ensureMembers from "./helpers/ensureMembers";


const app = express()
app.use(bodyParser.json())

const storage = new SimpleFsStorageProvider("storage.json");
const botStorage = botStorageLayer(storage)

const client = new MatrixClient(HOMESERVER_URL, ACCESS_TOKEN, storage);
AutojoinRoomsMixin.setupOnClient(client);
client.on("room.message", botDialog({botStorage, client}).handleCommand);


startInviteQueueWorker(client, INVITE_RATE_PER_SECOND)


async function updateInviteCodeElements(inviteCode: string) {
    const rooms = botStorage.getRooms(inviteCode)
    const members = botStorage.getInvitedIds(inviteCode)
    for(let roomId of rooms) {
        await ensureMembers(client, roomId, members)
    }
}

// regulary check the membership status of all invited users 
setInterval( async () => {
    const inviteCodes = botStorage.getAllInviteCodes()
    for(let inviteCode of inviteCodes) {
        await updateInviteCodeElements(inviteCode)
    } 
}, 1000)

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})

app.get('/health', async function (req, res, next) {
    const presence = await client.getPresenceStatus()
    const userId = await client.getUserId()
    if(presence && presence.state == 'online' && userId) {
        res.send({success: true, queueLength: getQueueLength()})
    } else {
        res.status(500)
        res.send({success: false, presence: presence.state})
    }
})

app.get('/metrics', async function (req, res, next) {
    const presence = await client.getPresenceStatus()
    const userId = await client.getUserId()
    if(presence && presence.state == 'online' && userId) {
        res.send(`
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
invite_bot_invites_total ${botStorage.getTotalInvitedCount()}

# HELP invite_bot_queue Number of invitation requests in the queue 
# TYPE invite_bot_queue gauge
invite_bot_queue ${getQueueLength()}
        `)
    } else {
        res.status(500)
        res.send('')
    }
})

app.post('/invite', async function (req,res) {
    if(!req.body 
        || !req.body.inviteCode
        || typeof req.body.inviteCode !== 'string'
        || !req.body.matrixId
        || typeof req.body.matrixId !== 'string'
    ) {
        res.status(400)
        res.send({
            success: false,
            error: 'missing or invalid fields (inviteCode, matrixId)'
        })
        return
    }
    
    const matrixId = req.body.matrixId
    const inviteCode = req.body.inviteCode
    
    if(!botStorage.isInviteCode(inviteCode)) {
        res.status(400)
        res.send({
            success: false,
            error: 'invalid invite code'
        })
        return
    }
    const rooms = botStorage.getRooms(inviteCode)

    if(!matrixId.match(/^@.*?:.*?$/)) {
        res.status(400)
        res.send({
            success: false,
            error: 'invalid matrix id'
        })
        return
    }

    botStorage.addInvitedId(inviteCode, matrixId)

    // trigger invites
    await updateInviteCodeElements(inviteCode)

    res.send({
        success: true,
    })
})

client.start().then(() => {
    console.log("Matrix client started!")
    app.listen(HTTP_LISTEN_PORT, () => {
        console.log("Express server started!")
    })
});


