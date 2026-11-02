#!/usr/bin/env python3
"""Optional mirror of the published snapshot for manual audits; not used at runtime."""
from pathlib import Path
import json,csv,sys
root=Path(__file__).resolve().parents[2]
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'INAPROC_MODAL_LENGKAP.json'
data=json.loads(source.read_text('utf-8-sig'))
previous={x['category_id']:x['kelompok'] for x in csv.DictReader((root/'database/import-master/PBJ_KATEGORI_META.csv').open(encoding='utf-8-sig',newline=''))}
files={
'META':(['category_id','kelompok','category_name','product_type','product_sub_type','is_active','allowed_transaction_method','integration_source','integration_provider','competition_document_needed','kbli_count','primary_field_count','additional_field_count'],[]),
'FIELD':(['category_id','kelompok','category_name','field_group','field_id','field_name','field_type','default_value','additional_info','urutan'],[]),
'KBLI':(['category_id','kelompok','category_name','kbli_code','kbli_version','aktif','urutan'],[])
}
for item in data['details']:
 c=item['category'];d=item['detail'];id=c['id'];grp=previous.get(id)
 if not grp:
  pt=c['productType'];sub=c.get('productSubType');grp=('Konstruksi' if pt=='SERVICE' and sub=='CONSTRUCTION' else 'Barang Material Konstruksi' if pt=='PHYSICAL' and sub=='CONSTRUCTION' else 'Alat Kesehatan' if sub=='MEDICAL_DEVICES' else 'Obat' if sub=='PHARMACY' else 'Digital' if pt=='DIGITAL' else 'Jasa Telekomunikasi' if sub=='TELCO' else 'Jasa' if pt=='SERVICE' else 'Barang')
 p,a=d.get('primaryInfo') or [],d.get('additionalInfo') or []
 files['META'][1].append([id,grp,c['name'],c['productType'],c.get('productSubType') or '',str(d.get('isActive',True)).lower(),d.get('allowedTransactionMethod') or '',d.get('integrationSource') or '',d.get('integrationProvider') or '',str(d.get('isCompetitionDocumentNeeded') or False).lower(),len(d.get('kbliCodes') or []),len(p),len(a)])
 for group,fields in [('PRIMARY',p),('ADDITIONAL',a)]:
  for n,f in enumerate(fields,1):
   x=f.get('additionalInfo')
   files['FIELD'][1].append([id,grp,c['name'],group,f.get('id') or '',f.get('name') or '',f.get('type') or '',f.get('defaultValue') or '',x if isinstance(x,str) else json.dumps(x,ensure_ascii=False,separators=(',',':')) if x is not None else '',n])
 for n,k in enumerate(d.get('kbliCodes') or [],1):files['KBLI'][1].append([id,grp,c['name'],k.get('code') or '',k.get('version') or '',str(d.get('isActive',True)).lower(),n])
for typ,(hdr,rows) in files.items():
 path=root/f'database/import-master/PBJ_KATEGORI_{typ}.csv'
 with path.open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.writer(f);w.writerow(hdr);w.writerows(rows)
 print(path.name,len(rows))
