
import { prisma } from "../src/lib/db"

async function main() {
    console.log("\n=== Subject Distribution ===")
    const subjects = await prisma.problem.groupBy({
        by: ['subject'],
        _count: { id: true }
    })
    console.table(subjects)

    console.log("\n=== Organization Distribution ===")
    const orgs = await prisma.problem.groupBy({
        by: ['organization'],
        _count: { id: true }
    })
    console.table(orgs)

    // Check some 'Private' candidates
    console.log("\n=== Private Candidates Check ===")
    const privateSample = await prisma.problem.findMany({
        where: {
            organization: { notIn: ["교육청", "평가원", "EBS"] }
        },
        take: 5,
        select: { organization: true, problemType: true, subject: true }
    })
    console.table(privateSample)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
