import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from "typeorm";
import { RefreshToken } from "./RefreshToken.entity";

export enum AuthProvider {
    LOCAL = "local",
    GOOGLE = "google",
    GITHUB = "github",
}

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar", length: 255 })
    name: string;

    @Index()
    @Column({ type: "varchar", length: 255, unique: true })
    email: string;

    // nullable for oauth users
    @Column({ type: "varchar", length: 255, nullable: true, select: false })
    password: string | null;

    @Column({
        type: "enum",
        enum: AuthProvider,
        default: AuthProvider.LOCAL,
    })
    authProvider: AuthProvider;

    @Column({ type: "varchar", length: 255, nullable: true })
    providerId: string | null;

    // local accounts only, oauth users are auto verified
    @Column({ type: "boolean", default: false })
    isEmailVerified: boolean;

    // sha-256 hash of the otp
    @Column({ type: "varchar", length: 64, nullable: true, select: false })
    emailVerificationCode: string | null;

    @Column({ type: "timestamptz", nullable: true })
    emailVerificationExpires: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    emailVerificationLastSentAt: Date | null;

    @Column({ type: "smallint", default: 0 })
    emailVerificationAttempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => RefreshToken, (token: RefreshToken) => token.user)
    refreshTokens: RefreshToken[];
}
