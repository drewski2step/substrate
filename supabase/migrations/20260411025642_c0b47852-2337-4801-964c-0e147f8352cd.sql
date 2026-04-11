
-- Create block_documents table
CREATE TABLE public.block_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.block_documents ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can view block_documents"
  ON public.block_documents FOR SELECT
  USING (true);

-- Authenticated insert
CREATE POLICY "Authenticated users can upload documents"
  ON public.block_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Only uploader can delete
CREATE POLICY "Users can delete own documents"
  ON public.block_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('block-documents', 'block-documents', true);

-- Storage policies
CREATE POLICY "Anyone can read block-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'block-documents');

CREATE POLICY "Authenticated users can upload to block-documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'block-documents');

CREATE POLICY "Users can delete own files from block-documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'block-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for block_documents
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_documents;
