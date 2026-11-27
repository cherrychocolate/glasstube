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
  with patch.object(b,'_request',return_value={'result':[{'bvid':'BV1xx411c7mD','title':'<em>镜像</em> &amp; 测试','author':'UP'}]}):
   data=b.route('/api/bilibili/search',{'q':['镜像']});v=data['items'][0]
   self.assertEqual(v['title'],'镜像 & 测试');self.assertEqual(v['mode'],'official');self.assertNotIn('stream',v);self.assertFalse(v['rights']['offline'])
 def test_empty_search_is_rejected(self):
  with self.assertRaises(ValueError):b.route('/api/bilibili/search',{'q':['  ']})
 def test_unknown_route_rejected(self):
  with self.assertRaises(ValueError):b.route('/api/bilibili/cookie',{})
if __name__=='__main__':unittest.main()
