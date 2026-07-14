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

export enum Plans {
    FREE = "free",
    PRO = "pro",
}

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar" })
    name: string;

    @Index()
    @Column({ type: "varchar", unique: true })
    email: string;

    @Column({ type: "varchar", nullable: true, select: false })
    password: string | null;

    @Column({
        type: "enum",
        enum: Plans,
        default: Plans.FREE,
    })
    plan: Plans;

    @Column({
        type: "enum",
        enum: AuthProvider,
        default: AuthProvider.LOCAL,
    })
    authProvider: AuthProvider;

    @Column({ type: "varchar", nullable: true })
    providerId: string | null;

    @Column({ type: "boolean", default: false })
    isEmailVerified: boolean;

    @Column({ type: "varchar", nullable: true, select: false })
    emailVerificationCode: string | null;

    @Column({ type: "int", default: 0 })
    emailVerificationAttempts: number;

    @Column({ type: "timestamptz", nullable: true })
    emailVerificationExpires: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    emailVerificationLastSentAt: Date | null;

    @Column({ type: "boolean", default: false })
    notifyFailureAlerts: boolean;

    @Column({ type: "boolean", default: false })
    notifyWeeklyDigest: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt: Date;

    @OneToMany(() => RefreshToken, (token: RefreshToken) => token.user)
    refreshTokens: RefreshToken[];
}
