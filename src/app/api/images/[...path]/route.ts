import { NextRequest, NextResponse } from "next/server"
import { readFile, readdir } from "fs/promises"
import path from "path"

// 이미지 폴더 경로 (환경변수로 설정 가능)
const IMAGE_BASE_PATH = process.env.IMAGE_BASE_PATH ||
  "/Volumes/SeokkiMAC/Coding/data_labeling_management/math_label_indexed_png_files/math_label_indexed_png"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const fileName = pathSegments.join("/")
    const filePath = path.join(IMAGE_BASE_PATH, fileName)

    // 보안: 경로 탈출 방지
    if (!filePath.startsWith(IMAGE_BASE_PATH)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const fileBuffer = await readFile(filePath)

    // 파일 확장자에 따른 MIME 타입
    const ext = path.extname(fileName).toLowerCase()
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    }

    const contentType = mimeTypes[ext] || "application/octet-stream"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Image fetch error:", error)
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }
}

// 특정 인덱스에 해당하는 이미지 목록 조회 API
export async function POST(request: NextRequest) {
  try {
    const { index } = await request.json()

    if (index === undefined) {
      return NextResponse.json({ error: "Index required" }, { status: 400 })
    }

    const files = await readdir(IMAGE_BASE_PATH)

    // 문제 이미지: {index}-1.png, {index}-2.png ...
    const problemImages = files
      .filter((f) => {
        const match = f.match(/^(\d+)-(\d+)\.png$/i)
        return match && parseInt(match[1]) === index
      })
      .sort((a, b) => {
        const numA = parseInt(a.match(/-(\d+)\.png$/i)?.[1] || "0")
        const numB = parseInt(b.match(/-(\d+)\.png$/i)?.[1] || "0")
        return numA - numB
      })

    // 해설 이미지: {index}_SOL-1.png, {index}_SOL-2.png ...
    const solutionImages = files
      .filter((f) => {
        const match = f.match(/^(\d+)_SOL-(\d+)\.png$/i)
        return match && parseInt(match[1]) === index
      })
      .sort((a, b) => {
        const numA = parseInt(a.match(/_SOL-(\d+)\.png$/i)?.[1] || "0")
        const numB = parseInt(b.match(/_SOL-(\d+)\.png$/i)?.[1] || "0")
        return numA - numB
      })

    return NextResponse.json({
      problemImages,
      solutionImages,
    })
  } catch (error) {
    console.error("Image list error:", error)
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 })
  }
}
