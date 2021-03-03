import {
    SimpleFsStorageProvider,
} from "matrix-bot-sdk";
export default function createSotrageLayer(storage: SimpleFsStorageProvider) {
    let data: {
        [inviteCode:string]: {
            adminIds: string[],
            roomIds: string[],
            invitedIds: string[]
        }
    } = null;

    function load() {
        // @ts-ignore
        data = storage.readValue('inviteBot') || {}
    }
    function store() {
        // @ts-ignore
        storage.storeValue('inviteBot', data)
    }

    return {
        addInviteCode(inviteCode: string) {
            load()
            data[inviteCode] = {
                adminIds: [],
                roomIds: [],
                invitedIds: []
            }
            store()
        },
        isInviteCode(inviteCode: string) {
            load()
            return !!data[inviteCode]
        },
        addAdmin(inviteCode: string, matrixId: string) {
            load()
            if(!data[inviteCode]) throw new Error('invite code invalid')
            if(!data[inviteCode].adminIds.includes(matrixId)) {
                data[inviteCode].adminIds.push(matrixId)
                store()
            }
        },
        isAdmin(inviteCode: string, matrixId: string) {
            load()
            if(!data[inviteCode]) return false
            return data[inviteCode].adminIds.includes(matrixId)
        },
        getInvitesForAdmin(matrixId: string): string[] {
            load()
            const res = []
            for(let code in data) {
                if(data[code].adminIds.includes(matrixId)) {
                    res.push(code)
                }
            }
            return res
        },
        getRooms(inviteCode: string) {
            load()
            if(!data[inviteCode]) return []
            return data[inviteCode].roomIds
        },
        addRoom(inviteCode: string, roomId: string) {
            load()
            if(!data[inviteCode]) throw new Error('invite code invalid')
            if(!data[inviteCode].roomIds.includes(roomId)) {
                data[inviteCode].roomIds.push(roomId)
                store()
            }
        },
        addInvitedId(inviteCode: string, matrixId: string) {
            load()
            if(!data[inviteCode]) throw new Error('invite code invalid')
            if(!data[inviteCode].invitedIds.includes(matrixId)) {
                data[inviteCode].invitedIds.push(matrixId)
                store()
            }
        },
        getInvitedIds(inviteCode: string) {
            load()
            if(!data[inviteCode]) throw new Error('invite code invalid')
            return data[inviteCode].invitedIds
        }
    }
}