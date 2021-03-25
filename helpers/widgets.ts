import { MatrixClient } from "matrix-bot-sdk";
import randomString from "./randomString";


export async function addEdumeetWidget(client: MatrixClient, roomId: string): Promise<string> {
    const confenceId = randomString(10)
    const stateKey = 'zirkuszelt-edumeet-'+Date.now()
    await client.sendStateEvent(roomId, 'im.vector.modular.widgets', stateKey, {
        "type": "edumeet",
        "url": "https://dimension.zirkuszelt.org/edumeet/?conferenceId=$conferenceId&domain=$domain&isAudioOnly=%24isAudioOnly&displayName=$matrix_display_name&avatarUrl=$matrix_avatar_url&userId=$matrix_user_id",
        "name": "Zirkuszelt Video Conference",
        "data": {
            "conferenceUrl": "https://edumeet-widget.zirkuszelt.org/"+confenceId,
            "domain": "edumeet-widget.zirkuszelt.org",
            "conferenceId": confenceId,
            "url": "https://dimension.zirkuszelt.org/edumeet/?conferenceId=$conferenceId&domain=$domain&isAudioOnly=%24isAudioOnly&displayName=$matrix_display_name&avatarUrl=$matrix_avatar_url&userId=$matrix_user_id",
            "dimension:app:metadata": {
                "inRoomId": roomId,
                "wrapperUrlBase": "",
                "wrapperId": "",
                "scalarWrapperId": null,
                "integration": {
                    "category": "widget",
                    "type": "edumeet"
                },
                "lastUpdatedTs": Date.now()
            }
        }
    })
    return stateKey
}

export async function setWidgetActive(client: MatrixClient, roomId: string, widgetId: string) {
    await client.sendStateEvent(roomId, 'io.element.widgets.layout', "", {
        "widgets": {
            [widgetId]: {
              "container": "top",
              "height": 70,
              "width": 100,
              "index": 0
            }
          }
    })
}