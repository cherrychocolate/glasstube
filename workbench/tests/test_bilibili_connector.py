import unittest
from unittest.mock import patch
import bilibili_connector as b
class ConnectorTests(unittest.TestCase):
 def test_guest_caps_do_not_claim_writes_or_offline(self):
  caps=b.route('/api/bilibili/capabilities',{})
  self.assertFalse(caps['accountConnected']);self.assertFalse(caps['offline']);self.assertFalse(caps['nativeControls'])
 def test_invalid_id_never_requests_network(self):
  with patch.object(b,'_request') as req:
   for ident in ['http://127.0.0.1','../etc/passwd','BV123','BV1234567890&cookie=x']:
    with self.assertRaises(ValueError):b.route('/api/bilibili/video',{'id':[ident]})
   req.assert_not_called()
 def test_search_result_strips_highlight_and_never_creates_stream(self):
  with patch.object(b,'_request',return_value={'result':[{'result_type':'video','data':[{'bvid':'BV1xx411c7mD','title':'<em>镜像</em> &amp; 测试','author':'UP'}]}]}):
   data=b.route('/api/bilibili/search',{'q':['镜像']});v=data['items'][0]
   self.assertEqual(v['title'],'镜像 & 测试');self.assertEqual(v['mode'],'official');self.assertNotIn('stream',v);self.assertFalse(v['rights']['offline'])
 def test_search_prioritizes_creator_and_uses_its_featured_videos(self):
  user = {'mid':123,'uname':'明日方舟','res':[{'bvid':'BV19k1Jz5Ea8','title':'宣传片'}]}
  result = {'result':[{'result_type':'bili_user','data':[user]}]}
  with patch.object(b,'_request',return_value=result) as request:
   data=b.search_feed('@明日方舟')
  request.assert_called_once_with('x/web-interface/search/all/v2',{'keyword':'明日方舟'})
  self.assertEqual(data['kind'],'creator')
  self.assertEqual(data['preferredCreator'],'123')
  self.assertEqual(data['creators'][0]['items'][0]['author'],'明日方舟')

 def test_bv_and_av_are_exact_lookups(self):
  for query in ('av170001','BV17x411w7KC','https://www.bilibili.com/video/BV17x411w7KC/'):
   with patch.object(b,'_request',return_value={'bvid':'BV17x411w7KC','title':'测试'}) as request:
    self.assertEqual(b.search_feed(query)['kind'],'id')
   request.assert_called_once_with('x/web-interface/view',{'bvid':'BV17x411w7KC'})

 def test_region_uses_upstream_partition_not_popular(self):
  with patch.object(b,'_request',return_value={'archives':[{'bvid':'BV1xx411c7mD','tname':'动漫杂谈'}]}) as request:
   data=b.region_feed({'id':['1'],'page':['2']})
  request.assert_called_once_with('x/web-interface/newlist',{'rid':1,'pn':2,'ps':10})
  self.assertEqual(data['items'][0]['topic'],'动漫杂谈')
  self.assertIsNone(data['nextPage'])

 def test_shorts_require_portrait_dimensions_and_short_runtime(self):
  portrait = {'dimension':{'width':720,'height':1280,'rotate':0},'duration':180,'videos':1}
  self.assertTrue(b.portrait_short(portrait))
  for invalid in (
      {**portrait,'duration':181},
      {**portrait,'videos':2},
      {**portrait,'dimension':{'width':1280,'height':720}},
      {**portrait,'dimension':{'width':720,'height':1280,'rotate':1}},
      {**portrait,'dimension':{}}):
   self.assertFalse(b.portrait_short(invalid))

 def test_empty_search_is_rejected(self):
  with self.assertRaises(ValueError):b.route('/api/bilibili/search',{'q':['  ']})
 def test_unknown_route_rejected(self):
  with self.assertRaises(ValueError):b.route('/api/bilibili/cookie',{})
if __name__=='__main__':unittest.main()
