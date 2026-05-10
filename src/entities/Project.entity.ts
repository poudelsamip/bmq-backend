import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User.entity";

@Entity("projects")
export class Project {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string | null;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ type: "uuid" })
    userId: string;

    @Column({ type: "text" })
    encryptedRedisUrl: string;

    @Column({ type: "varchar" })
    encryptionIv: string;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;
}
