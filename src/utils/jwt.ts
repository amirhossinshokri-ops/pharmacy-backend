import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
    role: string
      email: string
      }

      export const generateAccessToken = (payload: JwtPayload): string => {
        return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, {
            expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as string,
              } as jwt.SignOptions)
              }

              export const generateRefreshToken = (payload: JwtPayload): string => {
                return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, {
                    expiresIn: (process.env.JWT_REFRESH_EXPIRES || '7d') as string,
                      } as jwt.SignOptions)
                      }

                      export const verifyAccessToken = (token: string): JwtPayload => {
                        return jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JwtPayload
                        }

                        export const verifyRefreshToken = (token: string): JwtPayload => {
                          return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload
                          }

                          export const getRefreshTokenExpiry = (): Date => {
                            const val = process.env.JWT_REFRESH_EXPIRES || '7d'
                              const days = parseInt(val)
                                const d = new Date()
                                  d.setDate(d.getDate() + (isNaN(days) ? 7 : days))
                                    return d
                                    }