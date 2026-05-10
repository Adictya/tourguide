if vim.g.loaded_tourguide_nvim == 1 then
  return
end
vim.g.loaded_tourguide_nvim = 1

require("tourguide").setup()
