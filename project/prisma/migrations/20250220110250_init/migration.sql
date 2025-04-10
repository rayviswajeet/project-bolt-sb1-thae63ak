-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `siNo` INTEGER NOT NULL,
    `wbsNo` VARCHAR(191) NOT NULL,
    `taskName` VARCHAR(191) NOT NULL,
    `predecessorIds` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `actualStartDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `actualDuration` INTEGER NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `isMilestone` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Task_siNo_key`(`siNo`),
    INDEX `Task_siNo_idx`(`siNo`),
    INDEX `Task_level_idx`(`level`),
    INDEX `Task_predecessorIds_idx`(`predecessorIds`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
