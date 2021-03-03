import { randomBytes } from 'crypto'

export default function randomString(size = 21) {  
    return randomBytes(size)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, size)
}