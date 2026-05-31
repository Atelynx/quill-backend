import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy"

describe('jwt-strategy', () => {
    let strategy: JwtStrategy;
    let configService: Partial<ConfigService>;
    let mockedPayload = {
        email: "example@gmail.com",
        sub: "example"
    }
    beforeEach(() => {
        configService = {
            getOrThrow: jest.fn(() => "JWT_KEY_EXAMPLE")
        }
        strategy = new JwtStrategy(configService as ConfigService)



    })
    it('it should return payload', () => {

        expect(strategy.validate(
            mockedPayload
        )).toMatchObject(
            mockedPayload
        );


    })



})