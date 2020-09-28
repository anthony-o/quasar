import { h, defineComponent } from 'vue'

import Top from './table-top.js'
import TableHeader from './table-header.js'
import TableBody from './table-body.js'
import Bottom from './table-bottom.js'
import TableGrid from './table-grid.js'
import QVirtualScroll from '../virtual-scroll/QVirtualScroll.js'
import QLinearProgress from '../linear-progress/QLinearProgress.js'
import getTableMiddle from './get-table-middle.js'

import { commonVirtPropsList } from '../../mixins/virtual-scroll.js'
import DarkMixin from '../../mixins/dark.js'

import Sort from './table-sort.js'
import Filter from './table-filter.js'
import Pagination from './table-pagination.js'
import RowSelection from './table-row-selection.js'
import RowExpand from './table-row-expand.js'
import ColumnSelection from './table-column-selection.js'
import FullscreenMixin from '../../mixins/fullscreen.js'

import cache from '../../utils/cache.js'

const commonVirtPropsObj = {}
commonVirtPropsList.forEach(p => { commonVirtPropsObj[p] = {} })

export default defineComponent({
  name: 'QTable',

  mixins: [
    DarkMixin,

    FullscreenMixin,
    Top,
    TableHeader,
    TableBody,
    Bottom,
    TableGrid,
    Sort,
    Filter,
    Pagination,
    RowSelection,
    RowExpand,
    ColumnSelection
  ],

  props: {
    records: {
      type: Array,
      default: () => []
    },
    rowKey: {
      type: [ String, Function ],
      default: 'id'
    },

    columns: Array,
    loading: Boolean,
    binaryStateSort: Boolean,

    iconFirstPage: String,
    iconPrevPage: String,
    iconNextPage: String,
    iconLastPage: String,

    title: String,

    hideHeader: Boolean,

    grid: Boolean,
    gridHeader: Boolean,

    dense: Boolean,
    flat: Boolean,
    bordered: Boolean,
    square: Boolean,
    separator: {
      type: String,
      default: 'horizontal',
      validator: v => ['horizontal', 'vertical', 'cell', 'none'].includes(v)
    },
    wrapCells: Boolean,

    virtualScroll: Boolean,
    ...commonVirtPropsObj,

    noDataLabel: String,
    noResultsLabel: String,
    loadingLabel: String,
    selectedRowsLabel: Function,
    rowsPerPageLabel: String,
    paginationLabel: Function,

    color: {
      type: String,
      default: 'grey-8'
    },

    titleClass: [ String, Array, Object ],
    tableStyle: [ String, Array, Object ],
    tableClass: [ String, Array, Object ],
    tableHeaderStyle: [ String, Array, Object ],
    tableHeaderClass: [ String, Array, Object ],
    cardContainerClass: [ String, Array, Object ],
    cardContainerStyle: [ String, Array, Object ],
    cardStyle: [ String, Array, Object ],
    cardClass: [ String, Array, Object ]
  },

  emits: [
    'request', 'virtual-scroll', 'row-click', 'row-dblclick'
  ],

  data () {
    return {
      innerPagination: Object.assign({
        sortBy: null,
        descending: false,
        page: 1,
        rowsPerPage: this.rowsPerPageOptions.length > 0
          ? this.rowsPerPageOptions[0]
          : 5
      }, this.pagination)
    }
  },

  watch: {
    needsReset () {
      this.hasVirtScroll === true && this.$refs.virtScroll !== void 0 && this.$refs.virtScroll.reset()
    }
  },

  computed: {
    getRowKey () {
      return typeof this.rowKey === 'function'
        ? this.rowKey
        : row => row[this.rowKey]
    },

    hasVirtScroll () {
      return this.grid !== true && this.virtualScroll === true
    },

    needsReset () {
      return ['tableStyle', 'tableClass', 'tableHeaderStyle', 'tableHeaderClass', 'containerClass']
        .map(p => this[p]).join(';')
    },

    filteredSortedRows () {
      let rows = this.records

      if (this.isServerSide === true || rows.length === 0) {
        return rows
      }

      const { sortBy, descending } = this.computedPagination

      if (this.filter) {
        rows = this.filterMethod(rows, this.filter, this.computedCols, this.getCellValue)
      }

      if (this.columnToSort !== void 0) {
        rows = this.sortMethod(
          this.records === rows ? rows.slice() : rows,
          sortBy,
          descending
        )
      }

      return rows
    },

    filteredSortedRowsNumber () {
      return this.filteredSortedRows.length
    },

    computedRows () {
      let rows = this.filteredSortedRows

      if (this.isServerSide === true) {
        return rows
      }

      const { rowsPerPage } = this.computedPagination

      if (rowsPerPage !== 0) {
        if (this.firstRowIndex === 0 && this.records !== rows) {
          if (rows.length > this.lastRowIndex) {
            rows = rows.slice(0, this.lastRowIndex)
          }
        }
        else {
          rows = rows.slice(this.firstRowIndex, this.lastRowIndex)
        }
      }

      return rows
    },

    computedRowsNumber () {
      return this.isServerSide === true
        ? this.computedPagination.rowsNumber || 0
        : this.filteredSortedRowsNumber
    },

    nothingToDisplay () {
      return this.computedRows.length === 0
    },

    isServerSide () {
      return this.computedPagination.rowsNumber !== void 0
    },

    cardDefaultClass () {
      return ` q-table__card` +
        (this.isDark === true ? ' q-table__card--dark q-dark' : '') +
        (this.square === true ? ` q-table--square` : '') +
        (this.flat === true ? ` q-table--flat` : '') +
        (this.bordered === true ? ` q-table--bordered` : '')
    },

    containerClass () {
      return `q-table__container q-table--${this.separator}-separator column no-wrap` +
        (this.loading === true ? ' q-table--loading' : '') +
        (this.grid === true ? ' q-table--grid' : this.cardDefaultClass) +
        (this.isDark === true ? ` q-table--dark` : '') +
        (this.dense === true ? ` q-table--dense` : '') +
        (this.wrapCells === false ? ` q-table--no-wrap` : '') +
        (this.inFullscreen === true ? ` fullscreen scroll` : '')
    },

    virtProps () {
      const props = {}

      commonVirtPropsList
        .forEach(p => { props[p] = this[p] })

      if (props.virtualScrollItemSize === void 0) {
        props.virtualScrollItemSize = this.dense === true ? 28 : 48
      }

      return props
    }
  },

  render () {
    const child = [ this.__getTopDiv() ]
    const data = { class: this.containerClass }

    if (this.grid === true) {
      child.push(this.__getGridHeader())
    }
    else {
      Object.assign(data, {
        class: [ data.class, this.cardClass ],
        style: this.cardStyle
      })
    }

    child.push(
      this.__getBody(),
      this.__getBottomDiv()
    )

    if (this.loading === true && this.$slots.loading !== void 0) {
      child.push(
        this.$slots.loading()
      )
    }

    return h('div', data, child)
  },

  methods: {
    requestServerInteraction (prop = {}) {
      this.$nextTick(() => {
        this.$emit('request', {
          pagination: prop.pagination || this.computedPagination,
          filter: prop.filter || this.filter,
          getCellValue: this.getCellValue
        })
      })
    },

    resetVirtualScroll () {
      this.hasVirtScroll === true && this.$refs.virtScroll.reset()
    },

    __getBody () {
      if (this.grid === true) {
        return this.__getGridBody()
      }

      const header = this.hideHeader !== true ? this.__getTHead : void 0

      if (this.hasVirtScroll === true) {
        const body = this.$slots.body

        return h(QVirtualScroll, {
          ref: 'virtScroll',
          class: this.tableClass,
          style: this.tableStyle,
          ...this.virtProps,
          items: this.computedRows,
          type: '__qtable',
          tableColspan: this.computedColspan,
          'onVirtual-scroll': this.__onVScroll
        }, {
          default: props => this.__getTBodyTR(props.item, body, props.index),
          before: header
        })
      }

      return getTableMiddle({
        class: [ 'q-table__middle scroll', this.tableClass ],
        style: this.tableStyle
      }, [
        header(),
        this.__getTBody()
      ])
    },

    scrollTo (toIndex) {
      if (this.$refs.virtScroll !== void 0) {
        this.$refs.virtScroll.scrollTo(toIndex)
        return
      }

      toIndex = parseInt(toIndex, 10)
      const rowEl = this.$el.querySelector(`tbody tr:nth-of-type(${toIndex + 1})`)

      if (rowEl !== null) {
        const scrollTarget = this.$el.querySelector('.q-table__middle.scroll')
        const { offsetTop } = rowEl
        const direction = offsetTop < scrollTarget.scrollTop ? 'decrease' : 'increase'

        scrollTarget.scrollTop = offsetTop

        this.$emit('virtual-scroll', {
          index: toIndex,
          from: 0,
          to: this.pagination.rowsPerPage - 1,
          direction
        })
      }
    },

    __onVScroll (info) {
      this.$emit('virtual-scroll', info)
    },

    __getProgress () {
      return [
        h(QLinearProgress, {
          class: 'q-table__linear-progress',
          color: this.color,
          dark: this.isDark,
          indeterminate: true,
          trackColor: 'transparent'
        })
      ]
    }
  }
})
