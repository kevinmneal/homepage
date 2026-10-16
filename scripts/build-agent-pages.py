"""Export the public HTML as Markdown and generate its discovery files.

Uses only Python's standard library. HTML remains the source of truth. Run
without arguments after editing a page; --check validates without writing.
This is a small exporter for this site's markup, not a general HTML converter.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
from xml.sax.saxutils import escape as xml_escape


ROOT = Path(__file__).resolve().parents[1] / 'docs'
PAGES = ('index.html', 'lab/index.html')
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
OMIT_TAGS = {'aside', 'button', 'canvas', 'dialog', 'script', 'style', 'svg'}
OMIT_CLASSES = {'interaction-hint', 'row-number', 'row-category', 'expand-icon', 'lab-cta'}


@dataclass
class Element:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)

    def has_class(self, value):
        return value in self.attrs.get('class', '').split()

    def find(self, tag=None, css_class=None):
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and (css_class is None or child.has_class(css_class)):
                    yield child
                yield from child.find(tag, css_class)


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element('document')
        self.stack = [self.root]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        element = Element(tag, dict(attrs))
        self.stack[-1].children.append(element)
        if tag not in VOID:
            self.stack.append(element)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def omitted(node):
    return (node.tag in OMIT_TAGS or node.attrs.get('aria-hidden') == 'true'
            or 'hidden' in node.attrs
            or any(node.has_class(name) for name in OMIT_CLASSES))


def plain(node):
    if isinstance(node, str):
        return re.sub(r'\s+', ' ', node)
    if omitted(node):
        return ''
    return ''.join(plain(child) for child in node.children)


def escaped(text):
    return re.sub(r'([\\*_[\]])', r'\\\1', text)


def link(label, href, canonical):
    return f'[{escaped(label.strip())}]({urljoin(canonical, href)})'


def markdown(node, canonical):
    if isinstance(node, str):
        return escaped(re.sub(r'\s+', ' ', node))
    if omitted(node):
        return ''
    tag = node.tag
    if tag == 'figure':
        images = [image for image in node.find('img') if image.attrs.get('alt')]
        captions = list(node.find('figcaption'))
        return '\n\n' + '\n\n'.join(markdown(child, canonical) for child in images + captions) + '\n\n'
    if tag == 'img':
        return '!' + link(node.attrs.get('alt', ''), node.attrs['src'], canonical)
    if node.has_class('project-links'):
        return '\n\n' + ' · '.join(markdown(a, canonical) for a in node.find('a')) + '\n\n'
    if tag == 'a' and (node.has_class('lab-card') or node.has_class('lab-feature')):
        heading = next(node.find('h2'))
        paragraphs = '\n\n'.join(markdown(p, canonical).strip() for p in node.find('p'))
        return '\n\n## ' + link(plain(heading), node.attrs['href'], canonical) + '\n\n' + paragraphs + '\n\n'
    content = ''.join(markdown(child, canonical) for child in node.children).strip()
    if tag == 'a':
        return '[' + content + '](' + urljoin(canonical, node.attrs['href']) + ')'
    if tag == 'summary':
        titles = list(node.find(css_class='row-title'))
        if titles:
            subtitle = next(node.find(css_class='row-subtitle'))
            return '\n\n### ' + escaped(plain(titles[0])) + '\n\n' + escaped(plain(subtitle)) + '\n\n'
        return '\n\n## ' + content + '\n\n'
    if tag in {'h1', 'h2', 'h3', 'h4'}:
        return '\n\n' + '#' * int(tag[1]) + ' ' + content + '\n\n'
    if tag == 'li':
        return '\n- ' + re.sub(r'\s+', ' ', content) + '\n'
    if tag in {'p', 'div', 'section', 'details', 'ol', 'ul', 'main'}:
        if node.has_class('paper-copy'):
            return content
        return '\n\n' + content + '\n\n' if content else ''
    if tag in {'em', 'i', 'cite'}:
        return '*' + content + '*'
    if tag in {'strong', 'b'}:
        return '**' + content + '**'
    if node.has_class('paper-venue'):
        return ' — ' + content
    if tag == 'time':
        return ' · ' + content
    if tag == 'br':
        return '\n'
    # Keep explicit whitespace between inline elements; stripping each span
    # would merge words adjacent to emphasis or links.
    return ''.join(markdown(child, canonical) for child in node.children)


def tidy(text):
    lines = [line.strip() for line in text.splitlines()]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip() + '\n'


def read_page(relative):
    tree = Document((ROOT / relative).read_text(encoding='utf-8')).root
    canonical = next(n.attrs['href'] for n in tree.find('link') if n.attrs.get('rel') == 'canonical')
    description = next(n.attrs['content'] for n in tree.find('meta') if n.attrs.get('name') == 'description')
    title = plain(next(tree.find('title')))
    main = next(tree.find('main'))
    markdown_url = urljoin(canonical, 'index.md')
    browser_url = urljoin(canonical, 'index.md.txt')
    links = list(tree.find('link'))
    assert any(n.attrs.get('rel') == 'alternate' and n.attrs.get('type') == 'text/markdown'
               and urljoin(canonical, n.attrs['href']) == markdown_url for n in links), relative + ': missing Markdown discovery link'
    assert any(n.attrs.get('rel') == 'describedby' and urljoin(canonical, n.attrs['href']) == urljoin(canonical, '/llms.txt')
               for n in links), relative + ': missing llms.txt discovery link'
    footer = next(tree.find('footer'))
    assert any(urljoin(canonical, n.attrs['href']) == browser_url for n in footer.find('a')), relative + ': missing visible Markdown link'
    assert not any(n.attrs.get('name', '').lower() == 'robots' and 'noindex' in n.attrs.get('content', '').lower()
                   for n in tree.find('meta')), relative + ': source page is noindex'
    content = markdown(main, canonical)
    profiles = [a for a in footer.find('a') if 'me' in a.attrs.get('rel', '').split()]
    if profiles:
        content += '\n\n## Professional and scholarly profiles\n\n'
        content += '\n'.join('- ' + link(plain(a), a.attrs['href'], canonical) for a in profiles)
    result = f'Canonical page: {canonical}\n\n' + content
    # The source link is useful when this file is copied into an agent's context.
    return dict(tree=tree, main=main, canonical=canonical, description=description,
                title=title, profiles=profiles, markdown=tidy(result), markdown_url=markdown_url)


def outputs():
    pages = [read_page(path) for path in PAGES]
    home = pages[0]
    origin = home['canonical']
    result = {path.replace('.html', '.md'): page['markdown'] for path, page in zip(PAGES, pages)}
    # Browsers vary in whether text/markdown opens inline or downloads. The
    # visible links use identical .txt copies, served as text/plain by Pages.
    result.update({path.replace('.html', '.md.txt'): page['markdown'] for path, page in zip(PAGES, pages)})
    index = f"# {home['title']}\n\n> {home['description']}\n\n## Pages\n\n"
    index += '\n'.join('- ' + link(p['title'], p['markdown_url'], origin) + ': ' + p['description'] for p in pages)
    index += '\n\n## Research sources\n\n'
    for project in home['main'].find('details', 'project'):
        title = plain(next(project.find(css_class='row-title')))
        for group in project.find(css_class='project-links'):
            for a in group.find('a'):
                index += '- ' + link(title + ': ' + plain(a).strip(), a.attrs['href'], origin) + '\n'
    index += '\n## Profiles\n\n'
    index += '\n'.join('- ' + link(plain(a), a.attrs['href'], origin) for a in home['profiles'])
    result['llms.txt'] = tidy(index)
    result['sitemap.xml'] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                             + ''.join('  <url><loc>' + xml_escape(p['canonical']) + '</loc></url>\n' for p in pages)
                             + '</urlset>\n')
    result['robots.txt'] = 'User-agent: *\nDisallow:\n\nSitemap: ' + urljoin(origin, 'sitemap.xml') + '\n'

    # Catch broken internal destinations before publishing. External citations
    # stay exactly as authored in the HTML; no network request is needed here.
    for name, text in result.items():
        for url in re.findall(r'\]\((https?://[^\s)]+)\)', text):
            parsed = urlsplit(url)
            if parsed.netloc != urlsplit(origin).netloc:
                continue
            target = parsed.path.lstrip('/')
            if not target or target.endswith('/'):
                target += 'index.html'
            assert target in result or (ROOT / target).is_file(), f'{name}: missing target {url}'
    robots = RobotFileParser()
    robots.parse(result['robots.txt'].splitlines())
    for url in [p['canonical'] for p in pages] + [urljoin(origin, name) for name in result]:
        assert robots.can_fetch('*', url), 'Crawler access blocked: ' + url
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Fail if generated files are missing or stale')
    args = parser.parse_args()
    stale = []
    for name, expected in outputs().items():
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != expected:
                stale.append(name)
        else:
            path.write_text(expected, encoding='utf-8')
            print('Generated docs/' + name)
    if stale:
        raise SystemExit('Missing or stale: ' + ', '.join(stale) + '\nRun python3 scripts/build-agent-pages.py')
    if args.check:
        print('Seven generated files match the HTML; discovery links, local destinations, and crawler access verified.')


if __name__ == '__main__':
    main()
