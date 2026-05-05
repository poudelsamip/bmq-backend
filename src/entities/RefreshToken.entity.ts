import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm";
import { User } from "./User.entity";

@Entity("refresh_tokens")
export class RefreshToken {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Index()
    @Column({ type: "varchar", unique: true })
    tokenHash: string;

    @Column({ type: "uuid" })
    userId: string;

    @ManyToOne(() => User, (user: User) => user.refreshTokens, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ type: "timestamptz" })
    expiresAt: Date;

    @Column({ type: "boolean", default: false })
    isRevoked: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;
}
