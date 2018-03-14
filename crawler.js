const net = require('net')
const tls = require('tls')
const log = console.log.bind(console)

// 临时保存数据
let movies = []

const pathWithQuery = (path, query) => {
    if (query === null) {
        return path
    }
    let arr = []
    for (let k in query) {
        let s = `${k}=${query[k]}`
        arr.push(s)
    }
    let q = arr.join('&')

    let result = path + '?' + q
    return result
}

const protocolOfUrl = (url) => {
    if (url.startsWith('https://')) {
        return 'https'
    } else {
        return 'http'
    }
}

const hostOfUrl = (url) => {
    var str = url
    // 去除协议头
    if (str.startsWith('https://')) {
        str = str.slice(8)
    } else if (str.startsWith('http://')) {
        str = str.slice(7)
    }
    // 去除 path
    str = str.split('/')[0]
    // 去除 端口
    str = str.split(':')[0]

    return str
}

const portOfUrl = (url) => {
    var str = url
    var port = 80
    // 去除协议头
    if (str.startsWith('https://')) {
        str = str.slice(8)
        port = 443
    } else if (str.startsWith('http://')) {
        str = str.slice(7)
    }
    // 去除 path
    str = str.split('/')[0]
    // 获取 端口
    str = str.split(':')[1]
    if (str) {
        port = parseInt(str)
    }
    return port
}

const pathOfUrl = (url) => {
    var path = '/'
    var str = url
    // 去除协议头
    if (str.startsWith('https://')) {
        str = str.slice(8)
    } else if (str.startsWith('http://')) {
        str = str.slice(7)
    }
    // 去除 query
    if (str.indexOf('?')) {
        str = str.split('?')[0]
    }
    // 分割字符串
    var arr = str.split('/')
    if (arr.length > 1) {
        arr = arr.slice(1)
        path = '/' + arr.join('/')
    }
    return path
}

const parsedUrl = (url) => {
    var protocol = protocolOfUrl(url)
    var host = hostOfUrl(url)
    var port = portOfUrl(url)
    var path = pathOfUrl(url)
    var params = {
        protocol,
        host,
        port,
        path,
    }
    return params
}

const bodyFromResponse = (r) => {
    const b = r.split('\r\n\r\n')[1]
    return b
}

const codeFromResponse = (r) => {
    const req = r.split('\r\n')[0]
    const c = req.split(' ')[1]
    return parseInt(c)
}

const headersFromResponse = (r) => {
    const reqHeaders = r.split('\r\n\r\n')[0]
    const headers = reqHeaders.split('\r\n').slice(1)
    const obj = {}
    headers.forEach((item) => {
        let arr = item.split(': ')
        let key = arr[0]
        obj[key] = arr[1]
    })
    return obj
}

const parsedResponse = (r) => {
    const code = codeFromResponse(r)
    const headers = headersFromResponse(r)
    const body = bodyFromResponse(r)
    const obj = {
        code,
        headers,
        body,
    }
    return obj
}

const socketByProtocol = (protocol) => {
    const obj = {
        'http': net.Socket,
        'https': tls.TLSSocket
    }
    const s = obj[protocol]
    return new s()
}

const targetText = function (str, openTag, closingTag) {
    let result = ''
    if (str.includes(openTag)) {
        result = str.split(openTag)[1]
        result = result.split(closingTag)[0]
    }
    return result
}

const parsedMovie = (html) => {
    const titleOpenTag = '<span class="title">'
    const pointOpenTag = '<span class="rating_num" property="v:average">'
    const quoteOpenTag = '<span class="inq">'
    const closingTag = '</span>'
    const title = targetText(html, titleOpenTag, closingTag)
    const point = targetText(html, pointOpenTag, closingTag)
    const quote = targetText(html, quoteOpenTag, closingTag)
    const obj = {
        title,
        point,
        quote,
    }
    return obj
}

const parsedHtml = (html) => {
    let movies = []
    let arr = html.split('<div class="item">').slice(1)
    arr.forEach((item) => {
        let i = parsedMovie(item)
        movies.push(i)
    })
    return movies
}

const get = (url, query) => {
    let params = parsedUrl(url)
    let {protocol, host, port, path} = params
    let client = socketByProtocol(protocol)
    path = pathWithQuery(path, query)

    const promise = new Promise(function (resolve, reject) {
        client.connect(port, host, () => {
            const request = `GET ${path} HTTP/1.1\r\nHost:${host}\r\nConnection:close\r\n\r\n`
            client.write(request)
        })

        let html = ''

        client.on('data', (d) => {
            let r = d.toString()
            html += r
        })

        client.on('end', () => {
            const params = parsedResponse(html)
            const {code, headers, body} = params
            if (code === 301) {
                let newUrl = ''
                if (headers.Location) {
                    newUrl = headers.Location
                } else {
                    newUrl = url.replace('http://', 'https://')
                }
                get(newUrl, query)
            } else {
                const list = parsedHtml(body)
                movies = movies.concat(list)
                resolve(movies)
            }
        })

        client.on('error', function () {
            reject()
        })

        client.on('close', function() {
            log('close')
        })
    })

    return promise
}

const crawler = function() {
    const url = 'https://movie.douban.com/top250'

    const promiseList = []

    for (let i = 0; i < 10; i++) {
        let start = 25 * i
        let query = {
            start: start,
        }
        const p = get(url, query)
        promiseList.push(p)
    }

    Promise.all(promiseList).then(function (s) {
        log(s)
    })
}

const __main = () => {
    crawler()
}

__main()