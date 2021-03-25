import { MatrixClient } from "matrix-bot-sdk"

const inviteQueue: Array<{roomId: string, userId: string}> = []
export function inviteUser(userId: string, roomId: string) {
    if(inviteQueue.some((a) => a.roomId === roomId && a.userId === userId)) {
        // already in queue
        return
    }
    inviteQueue.push({
        userId,
        roomId
    })
}

export function startInviteQueueWorker(client: MatrixClient, ratePerSecond: number) {
    setInterval( async () => {
        const inv = inviteQueue.shift()
        if(!inv) return
        try {
            console.log(`invite ${inv.userId} -> ${inv.roomId} [Queue: ${inviteQueue.length+1}]`)
            await client.inviteUser(inv.userId, inv.roomId)
        } catch(err) {
            console.error(err)
            inviteQueue.push(inv)
        }
    }, 1000/ratePerSecond)    
}

export function getQueueLength() {
    return inviteQueue.length
}