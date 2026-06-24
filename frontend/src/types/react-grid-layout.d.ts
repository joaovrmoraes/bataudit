declare module 'react-grid-layout' {
  import * as React from 'react'

  export interface Layout {
    i: string
    x: number
    y: number
    w: number
    h: number
    minW?: number
    minH?: number
    maxW?: number
    maxH?: number
    static?: boolean
  }

  export interface ReactGridLayoutProps {
    className?: string
    layout?: Layout[]
    cols?: number
    rowHeight?: number
    width?: number
    margin?: [number, number]
    isResizable?: boolean
    isDraggable?: boolean
    draggableHandle?: string
    onLayoutChange?: (layout: Layout[]) => void
    children?: React.ReactNode
  }

  export default class GridLayout extends React.Component<ReactGridLayoutProps> {}
}
