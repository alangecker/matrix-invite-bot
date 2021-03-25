import { MatrixClient } from "matrix-bot-sdk"
import { inviteUser } from './inviteQueue'

export default async function ensureMembers(client: MatrixClient, roomId: string, members: string[]) {
    let missing = [...members]
    const current = await client.getRoomMembers(roomId)
    for(let member of current) {
        const missingIndex = missing.indexOf(member.membershipFor)
        if(missingIndex !== -1) missing.splice(missing.indexOf(member.membershipFor), 1)
        if(
            member.membership == 'leave' &&
            member.previousContent.membership == 'invite'
        ) {
            // lets assume, the person declined the invitation accidentely
            // 
            inviteUser(member.membershipFor, roomId)
        }
    }
    for(let userId of missing) {
        inviteUser(userId, roomId)
    }
}