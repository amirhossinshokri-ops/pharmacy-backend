import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger'

declare global {
  // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined
    }

    const prisma =
      global.__prisma ||
        new PrismaClient({
            log: [
                  { emit: 'event', level: 'query' },
                        { emit: 'event', level: 'error' },
                              { emit: 'event', level: 'warn' },
                                  ],
                                    })

                                    if (process.env.NODE_ENV !== 'production') {
                                      global.__prisma = prisma
                                      }

                                      // @ts-ignore
                                      prisma.$on('error', (e: any) => {
                                        logger.error('Prisma error:', e)
                                        })

                                        // @ts-ignore
                                        prisma.$on('warn', (e: any) => {
                                          logger.warn('Prisma warning:', e)
                                          })

                                          export default prisma
                                          
