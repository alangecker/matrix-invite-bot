import {
    MatrixClient, MatrixEvent,
} from "matrix-bot-sdk";
import storageLayer from './helpers/storageLayer'
import randomString from './helpers/randomString'
import { inviteUser } from "./helpers/inviteQueue";
import { addEdumeetWidget, setWidgetActive } from "./helpers/widgets";

export default function({
    botStorage,
    client
}: {
    botStorage: ReturnType<typeof storageLayer>,
    client: MatrixClient
}) {

    let roomMessageCallbacks: Map<string, Function> = new Map()
    async function nextRoomMessage(roomId: string): Promise<string> {
        return new Promise( (resolve) => {
            roomMessageCallbacks.set(roomId, resolve)
        })
    }

    async function handleCreate(senderId: string, inRoomId: string) {
        const inviteCode = randomString()
        botStorage.addInviteCode(inviteCode)
        botStorage.addAdmin(inviteCode, senderId)
        await client.sendMessage(inRoomId,  {
            body: 
    `New Invite code generated: ${inviteCode}.
            
    To add an existing room to this invite code, invite me first and write then
    !room.add ${inviteCode} ROOMID

    To create a new room call
    !room.create ${inviteCode}

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

    async function handleRoomCreate(senderId: string, inviteCode: string, inRoomId: string) {
        if(!inviteCode) {
            await client.sendMessage(inRoomId,  {
                body: 
    `Error: Invalid !room.create command. make sure to provide all parameter
        !room.create INVITECODE`,
                msgtype: "m.text",
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
        await client.sendMessage(inRoomId,  {
            body: `What title should the room have?`,
            msgtype: "m.text",
        })
        const title = await nextRoomMessage(inRoomId)
        
        const roomId = await client.createRoom({
            preset: 'private_chat',
            name: title,
            invite: [ senderId ]
        })
        await client.setUserPowerLevel(senderId, roomId, 100)
        const widgetId = await addEdumeetWidget(client, roomId)
        await setWidgetActive(client, roomId, widgetId)
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
            inviteUser(matrixId, roomId)
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

    return {
        async handleCommand(roomId: string, event: MatrixEvent<any>) {
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

            if(body[0] !== '!' && roomMessageCallbacks.get(roomId)) {
                roomMessageCallbacks.get(roomId)(body)
                return
            }

            const senderId = event.sender

            const [command, ...args] = body.split(' ')
            
            switch(command) {
                case '!create':
                    await handleCreate(senderId, roomId)
                    break

                case '!room.add':
                    await handleRoomAdd(senderId, args[0], args[1], roomId)
                    break
                
                case '!room.create':
                    await handleRoomCreate(senderId, args[0], roomId)
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
    }
}