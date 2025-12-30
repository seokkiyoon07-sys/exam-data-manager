import { NextRequest, NextResponse } from "next/server"
import { access } from "fs/promises"
import path from "path"

// 이미지 폴더 경로 (환경변수로 설정 가능)
const IMAGE_BASE_PATH = process.env.IMAGE_BASE_PATH ||
  "/Volumes/SeokkiMAC/Coding/data_labeling_management/math_label_indexed_png_files/math_label_indexed_png"

// 파일 존재 여부 확인 (빠른 방식)
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

// 순차적으로 파일 존재 확인 (1부터 시작, 없으면 중단)
async function findExistingFiles(
  basePath: string,
  index: number,
  pattern: "problem" | "solution",
  maxFiles: number = 20
): Promise<string[]> {
  const files: string[] = []

  for (let i = 1; i <= maxFiles; i++) {
    const fileName = pattern === "problem"
      ? `${index}-${i}.png`
      : `${index}_SOL-${i}.png`

    const filePath = path.join(basePath, fileName)

    if (await fileExists(filePath)) {
      files.push(fileName)
    } else {
      // 연속된 번호가 끊기면 중단
      break
    }
  }

  return files
}

export async function POST(request: NextRequest) {
  try {
    const { index } = await request.json()

    if (index === undefined) {
      return NextResponse.json({ error: "Index required" }, { status: 400 })
    }

    // 병렬로 문제/해설 이미지 확인
    const [problemImages, solutionImages] = await Promise.all([
      findExistingFiles(IMAGE_BASE_PATH, index, "problem"),
      findExistingFiles(IMAGE_BASE_PATH, index, "solution"),
    ])

    return NextResponse.json({
      problemImages,
      solutionImages,
    })
  } catch (error) {
    console.error("Image list error:", error)
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 })
  }
}
