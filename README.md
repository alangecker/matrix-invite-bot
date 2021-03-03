# matrix-invite-bot
_not beautiful, but working_

Handles a list of invite codes with rooms and offers an HTTP API to automatically invite a matixId to all these rooms with a provided invite code.

## setup
- set homeserver and access token in `config.ts`
- `$ yarn install`
- `$ yarn start`


## Matrix Commands
(start a unecrypted chat with the bot first)

- `!create`: creates a new invite code
- `!room.add INVITE_CODE ROOM_ID`: adds a room to the rooms list of the provided invite code
- `!list`: shows all generated invite codes, their rooms and how many users already have been invited

## HTTP API

- `POST /invite`: Invites a matrixId to all rooms associated with the invite code

    **Request Body**
    ```json
    {
        "inviteCode":"PqfbYbl0yP318uIzoHW8S",
        "matrixId":"@user:example.org"
    }
    ```

