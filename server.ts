import {
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
    RichReply,
} from "matrix-bot-sdk";
import {
    HOMESERVER_URL,
    ACCESS_TOKEN,
    HTTP_LISTEN_PORT
} from './config'
import botStorageLayer from './helpers/storageLayer'


import * as express from 'express'
import * as bodyParser from 'body-parser'
import randomString from './helpers/randomString'

const app = express()
app.use(bodyParser.json())

const storage = new SimpleFsStorageProvider("storage.json");
const client = new MatrixClient(HOMESERVER_URL, ACCESS_TOKEN, storage);
const botStorage = botStorageLayer(storage)
AutojoinRoomsMixin.setupOnClient(client);

client.on("room.message", handleCommand);

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
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

    for(let roomId of rooms) {
        console.log(`add ${matrixId} to ${roomId}`)
        console.log(roomId)
        try {
            const members = await client.getRoomMembers(roomId)

            if(members.find(m => m.membershipFor == matrixId)) {
                console.log(`${matrixId} is already part of the room`)
                continue
            }
            await client.inviteUser(matrixId, roomId)
        } catch(err) {
            console.error(err)
            res.status(500)
            res.send({
                success: false,
                error: `failed to invite to room '${roomId.slice(0,4)}...'. most likely the bot is not a member of the room`
            })
            return
        }
    }
    
    botStorage.addInvitedId(inviteCode, matrixId)
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



async function handleCreate(senderId: string, inRoomId: string) {
    const inviteCode = randomString()
    botStorage.addInviteCode(inviteCode)
    botStorage.addAdmin(inviteCode, senderId)
    await client.sendMessage(inRoomId,  {
        body: 
`New Invite code generated: ${inviteCode}.
        
To add a room to this invite code, invite me first and write then
  !room.add ${inviteCode} ROOMID

Remove a room again with
  !room.remove ${inviteCode} ROOMID

Add another admin with
  !admin.add ${inviteCode} MATRIXID

Show list of invite codes and their rooms
  !list
`,
        msgtype: "m.text",
    })
}

async function handleRoomAdd(senderId: string, inviteCode: string, roomId: string, inRoomId: string) {
    if(!inviteCode || !roomId) {
        await client.sendMessage(inRoomId,  {
            body: 
`Error: Invalid !room.add command. make sure to provide all parameter
    !room.add INVITECODE ROOMID`,
            msgtype: "m.text",
        })
        return
    }
    if(!roomId.match(/^!.*?:.*?$/)) {
        await client.sendMessage(inRoomId,  {
            msgtype: "m.text", body: `Error: invalid roomId. It should be in the form of !nVdIXysHXWsnjasosd:matrix.org`,
        })
        return
    }

    // is admin?
    if(!botStorage.isAdmin(inviteCode, senderId)) {
        await client.sendMessage(inRoomId,  {
            msgtype: "m.text", body: `Error: you are not an admin of the invite code '${inviteCode}'`,
        })
        return
    }

    // existing?
    const existingRooms = botStorage.getRooms(inviteCode)
    if(existingRooms.includes(roomId)) {
        await client.sendMessage(inRoomId,  {
            msgtype: "m.text", body: `Error: room is already included`,
        })
        return
    }

    // is bot a member?
    const botRooms = await client.getJoinedRooms()
    if(!botRooms.includes(roomId)) {
        await client.sendMessage(inRoomId,  {
            msgtype: "m.text", body: `Error: I can't see that room. make sure to invite me first`,
        })
        return
    }

    // store room
    botStorage.addRoom(inviteCode, roomId)

    // invite past invitees to room as well
    const alreadyInvitedIds = botStorage.getInvitedIds(inviteCode)
    for(let matrixId of alreadyInvitedIds) {
        try {
            await client.inviteUser(matrixId, roomId)
        } catch(err) {
            console.log(err)
        }
    }

    await client.sendMessage(inRoomId,  {
        msgtype: "m.text", body: `Room was successfully added`,
    })
}

async function handleList(senderId: string, inRoomId: string) {
    const codes = botStorage.getInvitesForAdmin(senderId)

    if(!codes.length) {
        await client.sendMessage(inRoomId,  {
            msgtype: "m.text", body: `you don't have any invite codes created yet. try out !create`,
        })
        return 
    }

    let msg = ''
    for(let code of codes) {
        const invited = botStorage.getInvitedIds(code)
        msg += `Code: ${code} (${invited.length} invited)\n`;
        const rooms = botStorage.getRooms(code)
        if(rooms.length) {
            for(let roomId of rooms) {
                msg += `  - ${roomId}\n`
            }
        } else {
            msg += '  no rooms added yet\n'
        }
        msg += '\n'
    }
    await client.sendMessage(inRoomId,  {
        msgtype: "m.text", body: msg,
    })
}

async function handleCommand(roomId: string, event) {
    console.log({roomId, event})
    if (!event["content"]) return;

    // Don't handle non-text events
    if (event["content"]["msgtype"] !== "m.text") return;

    // We never send `m.text` messages so this isn't required, however this is
    // how you would filter out events sent by the bot itself.
    if (event["sender"] === await client.getUserId()) return;

    // Make sure that the event looks like a command we're expecting
    const body = event["content"]["body"];
    if (!body) return;
    const senderId = event.sender

    const [command, ...args] = body.split(' ')

    
    switch(command) {
        case '!create':
            await handleCreate(senderId, roomId)
            break

        case '!room.add':
            await handleRoomAdd(senderId, args[0], args[1], roomId)
            break

        case '!room.delete':
            await client.sendMessage(roomId,  {
                msgtype: "m.text", body: `Error: !room.delete is not implemented yet`,
            })
            break

        case '!admin.add':
            await client.sendMessage(roomId,  {
                msgtype: "m.text", body: `Error: !admin.add is not implemented yet`,
            })
            break
        case '!list':
            await handleList(senderId, roomId)
            break
    }
}